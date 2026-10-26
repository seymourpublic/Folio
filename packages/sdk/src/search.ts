import type { PdfDocumentProxy } from "./pdfjs";
import type { BookmarkNode, DocPage } from "./document-model";
import type { DocumentMetadata } from "./export-pdf";
import { getPageText } from "./text-cache";

export type SearchMatch = {
  pageId: string;
  pageLabel: number;
  snippet: string;
  matchIndex: number;
};

const SNIPPET_RADIUS = 40;

export async function searchDocument(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  query: string
): Promise<SearchMatch[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: SearchMatch[] = [];

  for (let i = 0; i < pages.length; i++) {
    const docPage = pages[i];
    const doc = pdfjsDocs.get(docPage.sourceId);
    if (!doc) continue;

    const nativeText = await getPageText(doc, docPage.sourceId, docPage.sourcePageIndex);
    const ocrText = docPage.ocrWords?.map((w) => w.text).join(" ") ?? "";
    const pageText = ocrText ? `${nativeText} ${ocrText}` : nativeText;
    const lowerText = pageText.toLowerCase();

    let fromIndex = 0;
    while (true) {
      const matchIndex = lowerText.indexOf(trimmed, fromIndex);
      if (matchIndex === -1) break;

      const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
      const end = Math.min(pageText.length, matchIndex + trimmed.length + SNIPPET_RADIUS);
      const snippet =
        (start > 0 ? "…" : "") + pageText.slice(start, end).trim() + (end < pageText.length ? "…" : "");

      results.push({ pageId: docPage.id, pageLabel: i + 1, snippet, matchIndex });
      fromIndex = matchIndex + trimmed.length;
    }
  }

  return results;
}

export type UnifiedMatchKind = "content" | "annotation" | "metadata" | "bookmark";

export type UnifiedMatch = {
  id: string;
  pageId: string | null;
  pageLabel: number | null;
  kind: UnifiedMatchKind;
  title: string;
  snippet: string;
};

/** Powers the command palette's "In document" results: matches page content, annotation and
 * comment text, metadata and bookmark titles in one query. Capped at `limit`. */
export async function searchEverything(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  metadata: DocumentMetadata,
  bookmarks: BookmarkNode[],
  query: string,
  limit = 20
): Promise<UnifiedMatch[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: UnifiedMatch[] = [];
  const pageLabelById = new Map(pages.map((p, i) => [p.id, i + 1]));

  const metaFields: [string, string][] = [
    ["Title", metadata.title],
    ["Author", metadata.author],
    ["Subject", metadata.subject],
    ["Keywords", metadata.keywords.join(", ")],
  ];
  for (const [label, value] of metaFields) {
    if (value && value.toLowerCase().includes(trimmed)) {
      results.push({
        id: `meta-${label}`,
        pageId: null,
        pageLabel: null,
        kind: "metadata",
        title: `Metadata · ${label}`,
        snippet: value,
      });
    }
  }

  function walkBookmarks(nodes: BookmarkNode[]) {
    for (const node of nodes) {
      if (node.title.toLowerCase().includes(trimmed)) {
        results.push({
          id: `bookmark-${node.id}`,
          pageId: node.pageId,
          pageLabel: pageLabelById.get(node.pageId) ?? null,
          kind: "bookmark",
          title: "Bookmark",
          snippet: node.title,
        });
      }
      walkBookmarks(node.children);
    }
  }
  walkBookmarks(bookmarks);

  for (let i = 0; i < pages.length && results.length < limit; i++) {
    const docPage = pages[i];

    for (const a of docPage.annotations) {
      const texts: string[] =
        a.type === "text" || a.type === "callout" || a.type === "note"
          ? [a.text]
          : a.type === "text-edit"
            ? [a.newText]
            : [];
      if (a.replies) texts.push(...a.replies.map((r) => r.text));

      for (const t of texts) {
        if (t?.toLowerCase().includes(trimmed)) {
          results.push({
            id: `ann-${a.id}-${results.length}`,
            pageId: docPage.id,
            pageLabel: i + 1,
            kind: "annotation",
            title: `Page ${i + 1} · Annotation`,
            snippet: t,
          });
        }
      }
    }

    const doc = pdfjsDocs.get(docPage.sourceId);
    if (doc) {
      const nativeText = await getPageText(doc, docPage.sourceId, docPage.sourcePageIndex);
      const ocrText = docPage.ocrWords?.map((w) => w.text).join(" ") ?? "";
      const pageText = ocrText ? `${nativeText} ${ocrText}` : nativeText;
      const idx = pageText.toLowerCase().indexOf(trimmed);
      if (idx !== -1) {
        const start = Math.max(0, idx - SNIPPET_RADIUS);
        const end = Math.min(pageText.length, idx + trimmed.length + SNIPPET_RADIUS);
        const snippet =
          (start > 0 ? "…" : "") + pageText.slice(start, end).trim() + (end < pageText.length ? "…" : "");
        results.push({
          id: `content-${docPage.id}`,
          pageId: docPage.id,
          pageLabel: i + 1,
          kind: "content",
          title: `Page ${i + 1}`,
          snippet,
        });
      }
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}
