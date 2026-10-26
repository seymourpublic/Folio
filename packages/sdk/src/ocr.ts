import type { Worker } from "tesseract.js";
import type { OcrWord } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";
import { denoiseCanvas, detectSkewAngle, mapRotatedPointToOriginal, rotateCanvas } from "./ocr-preprocess";
import { getEngineConfig } from "./config";

const OCR_RASTER_SCALE = 2;

export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "rus", label: "Russian" },
  { code: "ara", label: "Arabic" },
  { code: "hin", label: "Hindi" },
];

export type OcrOptions = {
  languages?: string[];
  deskew?: boolean;
  denoise?: boolean;
};

let workerPromise: Promise<Worker> | null = null;
let workerLangs = "";
let workerIdleTimer: ReturnType<typeof setTimeout> | null = null;
let currentOnProgress: ((progress: number) => void) | undefined;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function getWorker(langs: string): Promise<Worker> {
  if (workerIdleTimer) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  const logger = (m: { status: string; progress: number }) => {
    if (m.status === "recognizing text" && typeof m.progress === "number") {
      currentOnProgress?.(m.progress);
    }
  };
  if (!workerPromise) {
    const { createWorker } = await import("tesseract.js");
    const { workerPath, corePath, langPath } = getEngineConfig().tesseract;
    workerLangs = langs;
    workerPromise = createWorker(langs, undefined, {
      logger,
      ...(workerPath ? { workerPath } : {}),
      ...(corePath ? { corePath } : {}),
      ...(langPath ? { langPath } : {}),
    });
  } else if (workerLangs !== langs) {
    const worker = await workerPromise;
    await worker.reinitialize(langs);
    workerLangs = langs;
  }
  return workerPromise;
}

function scheduleWorkerShutdown() {
  if (workerIdleTimer) clearTimeout(workerIdleTimer);
  workerIdleTimer = setTimeout(() => {
    const pending = workerPromise;
    workerPromise = null;
    workerLangs = "";
    workerIdleTimer = null;
    pending?.then((worker) => worker.terminate());
  }, 30_000);
}

export async function renderPageToCanvas(
  doc: PdfDocumentProxy,
  sourcePageIndex: number,
  rotation: number
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const page = await doc.getPage(sourcePageIndex + 1);
  const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360;
  const viewport = page.getViewport({ scale: OCR_RASTER_SCALE, rotation: totalRotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return { canvas, scale: OCR_RASTER_SCALE };
}

export async function ocrPage(
  doc: PdfDocumentProxy,
  sourcePageIndex: number,
  rotation: number,
  options: OcrOptions = {},
  onProgress?: (progress: number) => void
): Promise<OcrWord[]> {
  const { canvas: rendered, scale } = await renderPageToCanvas(doc, sourcePageIndex, rotation);

  let canvas = rendered;
  if (options.denoise) canvas = denoiseCanvas(canvas);

  let skewAngle = 0;
  if (options.deskew) {
    const detected = detectSkewAngle(canvas);
    if (Math.abs(detected) >= 0.25) {
      canvas = rotateCanvas(canvas, detected);
      skewAngle = detected;
    }
  }

  const langs = options.languages?.length ? options.languages.join("+") : "eng";

  return enqueue(async () => {
    const worker = await getWorker(langs);
    currentOnProgress = onProgress;
    try {
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const words: OcrWord[] = [];
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            for (const word of line.words) {
              if (!word.text.trim()) continue;
              const p0 = mapRotatedPointToOriginal(
                word.bbox.x0,
                word.bbox.y0,
                rendered.width,
                rendered.height,
                canvas.width,
                canvas.height,
                skewAngle
              );
              const p1 = mapRotatedPointToOriginal(
                word.bbox.x1,
                word.bbox.y1,
                rendered.width,
                rendered.height,
                canvas.width,
                canvas.height,
                skewAngle
              );
              const x0 = Math.min(p0.x, p1.x);
              const y0 = Math.min(p0.y, p1.y);
              words.push({
                text: word.text,
                x: x0 / scale,
                y: y0 / scale,
                width: Math.abs(p1.x - p0.x) / scale,
                height: Math.abs(p1.y - p0.y) / scale,
              });
            }
          }
        }
      }
      return words;
    } finally {
      currentOnProgress = undefined;
      scheduleWorkerShutdown();
    }
  });
}
