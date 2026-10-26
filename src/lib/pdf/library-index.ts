import { idbGet, idbPut } from "./idb";
import { loadPdfDocument } from "@folio/engine";
import { getLibraryDocBytes, listLibraryDocs } from "./library";

type PageTextRecord = { id: string; docId: string; pageIndex: number; text: string };
type WordIndexRecord = { id: string; docs: string[] };

const MIN_WORD_LENGTH = 2;

function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const set = new Set<string>();
  for (const w of words) {
    if (w.length >= MIN_WORD_LENGTH) set.add(w);
  }
  return set;
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 500 });
    } else {
      setTimeout(resolve, 32);
    }
  });
}

/** A document counts as indexed once it has at least one page-text record. */
async function isIndexed(docId: string): Promise<boolean> {
  const marker = await idbGet<PageTextRecord>("libpagetext", `${docId}:0`);
  return Boolean(marker);
}

/** Extracts per-page text from a stored document and folds its words into the library-wide
 * inverted index. Page text is kept separately so search can still produce a snippet. */
export async function indexLibraryDocument(docId: string): Promise<void> {
  const bytes = await getLibraryDocBytes(docId);
  if (!bytes) return;

  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  let doc;
  try {
    doc = await loadPdfDocument(arrayBuffer);
  } catch {
    return; // Corrupt/encrypted-without-password/etc. — leave unindexed rather than throw.
  }

  const wordsSeenThisDoc = new Set<string>();

  for (let i = 0; i < doc.numPages; i++) {
    let text = "";
    try {
      const page = await doc.getPage(i + 1);
      const content = await page.getTextContent();
      text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    } catch {
      // A single unreadable page shouldn't abort indexing the rest of the document.
    }

    await idbPut<PageTextRecord>("libpagetext", { id: `${docId}:${i}`, docId, pageIndex: i, text });
    for (const w of tokenize(text)) wordsSeenThisDoc.add(w);

    if (i % 5 === 4) await idle();
  }

  for (const word of wordsSeenThisDoc) {
    const existing = await idbGet<WordIndexRecord>("libwordindex", word);
    if (existing) {
      if (!existing.docs.includes(docId)) {
        existing.docs.push(docId);
        await idbPut<WordIndexRecord>("libwordindex", existing);
      }
    } else {
      await idbPut<WordIndexRecord>("libwordindex", { id: word, docs: [docId] });
    }
  }
}

/** Sweeps the whole library, indexing any document that doesn't have page-text yet. */
export function runLibraryBackgroundIndex(): () => void {
  let cancelled = false;

  (async () => {
    const docs = await listLibraryDocs().catch(() => []);
    for (const doc of docs) {
      if (cancelled) return;
      if (doc.trashed) continue;
      if (await isIndexed(doc.id)) continue;
      await indexLibraryDocument(doc.id);
      await idle();
    }
  })();

  return () => {
    cancelled = true;
  };
}

export type LibraryContentMatch = { docId: string; pageIndex: number; snippet: string };

const SNIPPET_RADIUS = 50;

/**
 * Two-tier lookup: the inverted index narrows the whole library down to documents containing every word in the query (cheap.
 */
export async function searchLibraryContent(query: string, limit = 30): Promise<LibraryContentMatch[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const queryWords = Array.from(tokenize(trimmed));
  if (queryWords.length === 0) return [];

  let candidateDocIds: Set<string> | null = null;
  for (const w of queryWords) {
    const record = await idbGet<WordIndexRecord>("libwordindex", w);
    const docsForWord = new Set<string>(record?.docs ?? []);
    if (candidateDocIds === null) {
      candidateDocIds = docsForWord;
    } else {
      const prev: Set<string> = candidateDocIds;
      candidateDocIds = new Set(Array.from(prev).filter((id) => docsForWord.has(id)));
    }
    if (candidateDocIds.size === 0) return [];
  }
  if (!candidateDocIds || candidateDocIds.size === 0) return [];

  const allDocs = await listLibraryDocs().catch(() => []);
  const pageCountById = new Map(allDocs.filter((d) => !d.trashed).map((d) => [d.id, d.pageCount]));

  const results: LibraryContentMatch[] = [];
  outer: for (const docId of candidateDocIds) {
    const pageCount = pageCountById.get(docId) ?? 0;
    for (let i = 0; i < pageCount; i++) {
      const record = await idbGet<PageTextRecord>("libpagetext", `${docId}:${i}`);
      if (!record) continue;
      const idx = record.text.toLowerCase().indexOf(trimmed);
      if (idx === -1) continue;
      const start = Math.max(0, idx - SNIPPET_RADIUS);
      const end = Math.min(record.text.length, idx + trimmed.length + SNIPPET_RADIUS);
      const snippet =
        (start > 0 ? "…" : "") + record.text.slice(start, end).trim() + (end < record.text.length ? "…" : "");
      results.push({ docId, pageIndex: i, snippet });
      if (results.length >= limit) break outer;
    }
  }

  return results;
}
