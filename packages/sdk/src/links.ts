import { PDFDict, PDFName, PDFArray, PDFString, type PDFPage, type PDFRef, type PDFDocument } from "pdf-lib";
import type { DocPage, LinkAnnotation } from "./document-model";

function addLinkAnnotationToPage(
  page: PDFPage,
  link: LinkAnnotation,
  pageHeight: number,
  pageRefs: Map<string, PDFRef>
): void {
  const context = page.doc.context;
  const flipY = (y: number) => pageHeight - y;

  const rectArray = context.obj([link.x, flipY(link.y + link.height), link.x + link.width, flipY(link.y)]);

  let actionDict: PDFDict;
  if (link.target.kind === "url") {
    if (!link.target.url) return;
    actionDict = PDFDict.withContext(context);
    actionDict.set(PDFName.of("Type"), PDFName.of("Action"));
    actionDict.set(PDFName.of("S"), PDFName.of("URI"));
    actionDict.set(PDFName.of("URI"), PDFString.of(link.target.url));
  } else {
    const targetRef = pageRefs.get(link.target.pageId);
    if (!targetRef) return;
    actionDict = PDFDict.withContext(context);
    actionDict.set(PDFName.of("Type"), PDFName.of("Action"));
    actionDict.set(PDFName.of("S"), PDFName.of("GoTo"));
    actionDict.set(PDFName.of("D"), context.obj([targetRef, PDFName.of("Fit")]));
  }

  const linkDict = PDFDict.withContext(context);
  linkDict.set(PDFName.of("Type"), PDFName.of("Annot"));
  linkDict.set(PDFName.of("Subtype"), PDFName.of("Link"));
  linkDict.set(PDFName.of("Rect"), rectArray);
  linkDict.set(PDFName.of("Border"), context.obj([0, 0, 0]));
  linkDict.set(PDFName.of("A"), actionDict);

  const linkRef = context.register(linkDict);

  const existingAnnots = page.node.get(PDFName.of("Annots"));
  const annotsArray = existingAnnots
    ? context.lookup(existingAnnots, PDFArray)
    : (() => {
        const arr = context.obj([]);
        page.node.set(PDFName.of("Annots"), arr);
        return arr;
      })();
  annotsArray.push(linkRef);
}

export function applyLinkAnnotations(output: PDFDocument, pages: DocPage[]): void {
  const pageRefs = new Map<string, PDFRef>();
  pages.forEach((docPage, index) => pageRefs.set(docPage.id, output.getPage(index).ref));

  pages.forEach((docPage, index) => {
    const page = output.getPage(index);
    const { height } = page.getSize();
    for (const ann of docPage.annotations) {
      if (ann.type === "link") addLinkAnnotationToPage(page, ann, height, pageRefs);
    }
  });
}
