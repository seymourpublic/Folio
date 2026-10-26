import type { PdfDocumentProxy } from "./pdfjs";
import type { StructTreeNode, StructTreeContent } from "pdfjs-dist/types/src/display/api";

export type TagNode = StructTreeNode | StructTreeContent;

export function isStructTreeNode(node: TagNode): node is StructTreeNode {
  return "role" in node;
}

/**
 * `getMarkInfo()` returning non-null with `Marked: true` is the PDF's own self-declared "I am a tagged PDF" flag (spec table 321).
 */
export async function getDocumentTagStatus(doc: PdfDocumentProxy): Promise<{ marked: boolean }> {
  try {
    const info = await doc.getMarkInfo();
    return { marked: Boolean(info?.Marked) };
  } catch {
    return { marked: false };
  }
}

export async function getPageStructTree(doc: PdfDocumentProxy, sourcePageIndex: number): Promise<StructTreeNode | null> {
  try {
    const page = await doc.getPage(sourcePageIndex + 1);
    const tree = await page.getStructTree();
    return tree ?? null;
  } catch {
    return null;
  }
}

/** A struct tree with a root but no real descendants is, for a user's purposes, the same as
 * "not tagged" — this is what actually decides the panel's empty state, not `Marked` alone. */
export function structTreeHasContent(tree: StructTreeNode | null): boolean {
  if (!tree) return false;
  return tree.children.length > 0;
}

const ROLE_LABELS: Record<string, string> = {
  Document: "Document",
  Part: "Part",
  Div: "Section",
  Sect: "Section",
  Art: "Article",
  P: "Paragraph",
  H: "Heading",
  H1: "Heading 1",
  H2: "Heading 2",
  H3: "Heading 3",
  H4: "Heading 4",
  H5: "Heading 5",
  H6: "Heading 6",
  L: "List",
  LI: "List item",
  Lbl: "Label",
  LBody: "List body",
  Table: "Table",
  TR: "Table row",
  TH: "Table header cell",
  TD: "Table cell",
  THead: "Table head",
  TBody: "Table body",
  TFoot: "Table foot",
  Figure: "Figure",
  Formula: "Formula",
  Caption: "Caption",
  Link: "Link",
  Note: "Note",
  Reference: "Reference",
  BlockQuote: "Block quote",
  TOC: "Table of contents",
  TOCI: "TOC item",
  Index: "Index",
  NonStruct: "Non-structural",
  Private: "Private",
  Span: "Span",
  Quote: "Quote",
  Code: "Code",
  Annot: "Annotation",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Coarse grouping used to color/flag tags the panel calls out. */
export function roleKind(role: string): "heading" | "table" | "figure" | "list" | "link" | "other" {
  if (/^H[1-6]?$/.test(role)) return "heading";
  if (role === "Table" || role === "TR" || role === "TH" || role === "TD") return "table";
  if (role === "Figure" || role === "Formula") return "figure";
  if (role === "L" || role === "LI" || role === "Lbl" || role === "LBody") return "list";
  if (role === "Link") return "link";
  return "other";
}
