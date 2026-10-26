import PptxGenJS from "pptxgenjs";
import type { DocPage } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";
import { exportAllPagesAsImages } from "./convert";

const SLIDE_WIDTH_IN = 10;

/** One slide per PDF page, each a full-bleed image of that page. */
export async function toPptx(pages: DocPage[], pdfjsDocs: Map<string, PdfDocumentProxy>): Promise<Uint8Array> {
  const images = await exportAllPagesAsImages(pages, pdfjsDocs, "png", 2);
  const pptx = new PptxGenJS();

  const first = images[0];
  const aspect = first ? first.height / first.width : 0.75;
  pptx.defineLayout({ name: "FOLIO_PAGE", width: SLIDE_WIDTH_IN, height: SLIDE_WIDTH_IN * aspect });
  pptx.layout = "FOLIO_PAGE";

  for (const image of images) {
    const slide = pptx.addSlide();
    const dataUrl = `data:image/png;base64,${bytesToBase64(image.bytes)}`;
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: SLIDE_WIDTH_IN, h: SLIDE_WIDTH_IN * aspect });
  }

  const out = await pptx.write({ outputType: "uint8array" });
  return out as Uint8Array;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
