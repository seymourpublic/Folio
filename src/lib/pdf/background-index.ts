import { getPageText, type DocPage, type OcrWord, type PdfDocumentProxy } from "@folio/engine";
import { ocrPage } from "@folio/engine/ocr";
import { getOcrDenoise, getOcrDeskew, getOcrLanguages } from "@/lib/app-settings";

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 500 });
    } else {
      setTimeout(resolve, 32);
    }
  });
}

/**
 * Warms the text cache for every page, then OCRs only the pages with no extractable text,
 * one at a time. Returns a cancel function.
 */
export function runBackgroundIndexing(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  onPageOcred: (pageId: string, words: OcrWord[]) => void
): () => void {
  let cancelled = false;

  (async () => {
    for (const p of pages) {
      if (cancelled) return;
      const doc = pdfjsDocs.get(p.sourceId);
      if (!doc) continue;
      await getPageText(doc, p.sourceId, p.sourcePageIndex);
      await idle();
    }

    for (const p of pages) {
      if (cancelled) return;
      if (p.ocrWords) continue;
      const doc = pdfjsDocs.get(p.sourceId);
      if (!doc) continue;

      const text = await getPageText(doc, p.sourceId, p.sourcePageIndex);
      if (text.trim().length > 0) continue;
      if (cancelled) return;

      try {
        const words = await ocrPage(doc, p.sourcePageIndex, p.rotation, {
          languages: getOcrLanguages(),
          deskew: getOcrDeskew(),
          denoise: getOcrDenoise(),
        });
        if (!cancelled) onPageOcred(p.id, words);
      } catch {
        // Best-effort: a page that fails to OCR just stays un-indexed.
      }
      await idle();
    }
  })();

  return () => {
    cancelled = true;
  };
}
