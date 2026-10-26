import type { PdfDocumentProxy } from "./pdfjs";

export type WordDiffToken = { type: "equal" | "add" | "remove"; value: string };

/**
 * Word-level LCS diff — the classic DP algorithm (not a heuristic/AI approach), same family as `diff`/`git diff --word-diff`.
 */
export function diffWords(a: string, b: string): WordDiffToken[] {
  const aTokens = a.split(/(\s+)/).filter((t) => t.length > 0);
  const bTokens = b.split(/(\s+)/).filter((t) => t.length > 0);
  const n = aTokens.length;
  const m = bTokens.length;

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aTokens[i] === bTokens[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: WordDiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aTokens[i] === bTokens[j]) {
      result.push({ type: "equal", value: aTokens[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "remove", value: aTokens[i] });
      i++;
    } else {
      result.push({ type: "add", value: bTokens[j] });
      j++;
    }
  }
  while (i < n) result.push({ type: "remove", value: aTokens[i++] });
  while (j < m) result.push({ type: "add", value: bTokens[j++] });

  return result;
}

/** Above this word count, the O(n*m) DP table gets too large to compute responsively. */
export const MAX_DIFF_WORDS = 3000;

export function countChanges(tokens: WordDiffToken[]): number {
  return tokens.filter((t) => t.type !== "equal").length;
}

export async function getPageTextForCompare(doc: PdfDocumentProxy, pageIndex: number): Promise<string> {
  try {
    const page = await doc.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  } catch {
    return "";
  }
}

export type PixelDiffResult = { canvas: HTMLCanvasElement; diffPixels: number; totalPixels: number };

const DIFF_THRESHOLD = 40;
const DIFF_SCALE = 1.5;

/** Renders both pages at the same scale and highlights differing pixels in red over a
 * desaturated backdrop. Per-pixel, with no perceptual or structural modeling. */
export async function renderVisualDiff(
  docA: PdfDocumentProxy,
  pageIndexA: number,
  docB: PdfDocumentProxy,
  pageIndexB: number
): Promise<PixelDiffResult> {
  const [bitmapA, bitmapB] = await Promise.all([
    renderPageBitmap(docA, pageIndexA),
    renderPageBitmap(docB, pageIndexB),
  ]);

  const w = Math.max(bitmapA.width, bitmapB.width);
  const h = Math.max(bitmapA.height, bitmapB.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(w, h);

  let diffPixels = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const outIdx = (y * w + x) * 4;
      const inA = x < bitmapA.width && y < bitmapA.height;
      const inB = x < bitmapB.width && y < bitmapB.height;
      const aIdx = inA ? (y * bitmapA.width + x) * 4 : -1;
      const bIdx = inB ? (y * bitmapB.width + x) * 4 : -1;
      const ar = inA ? bitmapA.data[aIdx] : 255;
      const ag = inA ? bitmapA.data[aIdx + 1] : 255;
      const ab = inA ? bitmapA.data[aIdx + 2] : 255;
      const br = inB ? bitmapB.data[bIdx] : 255;
      const bg = inB ? bitmapB.data[bIdx + 1] : 255;
      const bb = inB ? bitmapB.data[bIdx + 2] : 255;
      const delta = Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);

      if (delta > DIFF_THRESHOLD || inA !== inB) {
        diffPixels++;
        out.data[outIdx] = 220;
        out.data[outIdx + 1] = 38;
        out.data[outIdx + 2] = 38;
        out.data[outIdx + 3] = 190;
      } else {
        const gray = Math.round((ar + ag + ab) / 3);
        out.data[outIdx] = gray;
        out.data[outIdx + 1] = gray;
        out.data[outIdx + 2] = gray;
        out.data[outIdx + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);

  return { canvas, diffPixels, totalPixels: w * h };
}

async function renderPageBitmap(doc: PdfDocumentProxy, pageIndex: number): Promise<ImageData> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: DIFF_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
