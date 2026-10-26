import { PDFDict, PDFName, PDFString, PDFNumber, type PDFRef, type PDFContext, type PDFDocument } from "pdf-lib";
import type { BookmarkNode, DocPage } from "./document-model";

function buildOutlineLevel(
  context: PDFContext,
  nodes: BookmarkNode[],
  parentRef: PDFRef,
  pageRefs: Map<string, PDFRef>
): { first: PDFRef; last: PDFRef; count: number } | null {
  const validNodes = nodes.filter((n) => pageRefs.has(n.pageId));
  if (validNodes.length === 0) return null;

  const itemRefs = validNodes.map(() => context.nextRef());
  let visibleCount = validNodes.length;

  validNodes.forEach((node, i) => {
    const dict = PDFDict.withContext(context);
    dict.set(PDFName.of("Title"), PDFString.of(node.title || "Untitled"));
    dict.set(PDFName.of("Parent"), parentRef);
    if (i > 0) dict.set(PDFName.of("Prev"), itemRefs[i - 1]);
    if (i < itemRefs.length - 1) dict.set(PDFName.of("Next"), itemRefs[i + 1]);

    const pageRef = pageRefs.get(node.pageId)!;
    dict.set(PDFName.of("Dest"), context.obj([pageRef, PDFName.of("Fit")]));

    const child = buildOutlineLevel(context, node.children, itemRefs[i], pageRefs);
    if (child) {
      dict.set(PDFName.of("First"), child.first);
      dict.set(PDFName.of("Last"), child.last);
      dict.set(PDFName.of("Count"), PDFNumber.of(child.count));
      visibleCount += child.count;
    }

    context.assign(itemRefs[i], dict);
  });

  return { first: itemRefs[0], last: itemRefs[itemRefs.length - 1], count: visibleCount };
}

export function applyBookmarks(output: PDFDocument, bookmarks: BookmarkNode[], pages: DocPage[]): void {
  if (bookmarks.length === 0) return;

  const pageRefs = new Map<string, PDFRef>();
  pages.forEach((docPage, index) => {
    pageRefs.set(docPage.id, output.getPage(index).ref);
  });

  const context = output.context;
  const outlineRootRef = context.nextRef();
  const result = buildOutlineLevel(context, bookmarks, outlineRootRef, pageRefs);
  if (!result) return;

  const rootDict = PDFDict.withContext(context);
  rootDict.set(PDFName.of("Type"), PDFName.of("Outlines"));
  rootDict.set(PDFName.of("First"), result.first);
  rootDict.set(PDFName.of("Last"), result.last);
  rootDict.set(PDFName.of("Count"), PDFNumber.of(result.count));
  context.assign(outlineRootRef, rootDict);

  output.catalog.set(PDFName.of("Outlines"), outlineRootRef);
}
