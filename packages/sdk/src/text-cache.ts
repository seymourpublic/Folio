import type { PdfDocumentProxy } from "./pdfjs";

const cache = new Map<string, string>();

function cacheKey(sourceId: string, sourcePageIndex: number): string {
  return `${sourceId}:${sourcePageIndex}`;
}

/** Returns a page's native (non-OCR) text, extracting and caching it on first access so
 * repeated lookups (e.g. re-searching as the user types) don't re-run pdf.js text extraction. */
export async function getPageText(
  doc: PdfDocumentProxy,
  sourceId: string,
  sourcePageIndex: number
): Promise<string> {
  const key = cacheKey(sourceId, sourcePageIndex);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const page = await doc.getPage(sourcePageIndex + 1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  cache.set(key, text);
  return text;
}
