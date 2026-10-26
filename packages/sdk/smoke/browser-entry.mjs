// Bundled by esbuild (see browser-smoke.mjs) into a single self-contained script and loaded
// in a real Chromium page via Playwright. Runs entirely client-side; results are reported back
// to the Node driver via window.__SMOKE_RESULTS__ / window.__SMOKE_DONE__.
import { PDFDocument } from "pdf-lib";
import {
  createId,
  pagesFromSource,
  loadPdfDocument,
  exportDocument,
  extractAllPagesParagraphs,
  searchDocument,
  configureEngine,
  getEngineConfig,
} from "../dist/index.js";

const results = [];

/** A Uint8Array's `.buffer` may be a larger, shared ArrayBuffer (non-zero byteOffset) — slice
 * to the view's own bounds before handing it to an API that wants a standalone ArrayBuffer. */
function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err instanceof Error ? err.stack ?? err.message : String(err) });
  }
}

async function run() {
  configureEngine({ pdfWorkerSrc: "/pdf.worker.min.mjs" });

  const sampleText = "Hello browser smoke test — folio engine round trip.";
  let bytes;
  await check("build a tiny PDF with pdf-lib", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawText(sampleText, { x: 20, y: 260, size: 12 });
    bytes = await doc.save();
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error("expected non-empty bytes");
  });

  let pdfDoc;
  await check("loadPdfDocument loads it via configured pdf.js worker", async () => {
    pdfDoc = await loadPdfDocument(toArrayBuffer(bytes));
    if (pdfDoc.numPages !== 1) throw new Error(`expected 1 page, got ${pdfDoc.numPages}`);
  });

  const sourceId = createId();
  const pages = pagesFromSource(sourceId, 1);
  const sources = new Map([[sourceId, { id: sourceId, name: "smoke.pdf", bytes }]]);
  const pdfjsDocs = new Map([[sourceId, pdfDoc]]);

  await check("extractAllPagesParagraphs finds the drawn text", async () => {
    const paragraphs = await extractAllPagesParagraphs(pages, pdfjsDocs);
    const joined = paragraphs.flat().join(" ");
    if (!joined.includes("browser smoke test")) {
      throw new Error(`expected extracted text to include sample text, got: ${JSON.stringify(paragraphs)}`);
    }
  });

  await check("searchDocument finds a match for the drawn text", async () => {
    const matches = await searchDocument(pages, pdfjsDocs, "browser smoke");
    if (matches.length === 0) throw new Error("expected at least one search match");
  });

  await check("exportDocument round-trips to a loadable PDF", async () => {
    const exported = await exportDocument(pages, sources, pdfjsDocs);
    const magic = new TextDecoder().decode(exported.slice(0, 5));
    if (magic !== "%PDF-") throw new Error(`expected %PDF- magic bytes, got ${JSON.stringify(magic)}`);
    const reloaded = await loadPdfDocument(toArrayBuffer(exported));
    if (reloaded.numPages !== 1) throw new Error(`expected reloaded doc to have 1 page, got ${reloaded.numPages}`);
  });

  await check("configureEngine plumbs tesseract asset overrides", async () => {
    configureEngine({ tesseract: { workerPath: "/x", corePath: "/y", langPath: "/z" } });
    const cfg = getEngineConfig();
    if (cfg.tesseract.workerPath !== "/x" || cfg.tesseract.corePath !== "/y" || cfg.tesseract.langPath !== "/z") {
      throw new Error(`tesseract config not plumbed through: ${JSON.stringify(cfg.tesseract)}`);
    }
  });

  window.__SMOKE_RESULTS__ = results;
  window.__SMOKE_DONE__ = true;
}

run().catch((err) => {
  window.__SMOKE_RESULTS__ = results;
  window.__SMOKE_FATAL__ = err instanceof Error ? err.stack ?? err.message : String(err);
  window.__SMOKE_DONE__ = true;
});
