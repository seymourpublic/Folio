import type { DocPage } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";
import { renderPageToCanvas } from "./ocr";
import { detectBarcodesOnCanvas, type DetectedBarcode } from "./barcode";

export type PageBarcodeResult = { pageIndex: number; codes: DetectedBarcode[] };

export async function scanDocumentForBarcodes(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  onProgress?: (done: number, total: number) => void
): Promise<PageBarcodeResult[]> {
  const results: PageBarcodeResult[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const doc = pdfjsDocs.get(p.sourceId);
    if (doc) {
      const { canvas } = await renderPageToCanvas(doc, p.sourcePageIndex, p.rotation);
      const codes = await detectBarcodesOnCanvas(canvas);
      if (codes.length > 0) results.push({ pageIndex: i, codes });
    }
    onProgress?.(i + 1, pages.length);
  }
  return results;
}
