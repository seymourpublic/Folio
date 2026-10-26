import type { DocPage } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";

/** Reconstructs paragraphs from pdf.js's text-item stream using each item's `hasEOL` flag
 * and a y-gap heuristic. Tables and columns read out of order; see convert-table.ts. */
async function extractPageParagraphs(doc: PdfDocumentProxy, sourcePageIndex: number): Promise<string[]> {
  const page = await doc.getPage(sourcePageIndex + 1);
  const content = await page.getTextContent();

  const lines: { text: string; y: number; height: number }[] = [];
  let lineText = "";
  let lineY: number | null = null;
  let lineHeight = 10;

  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    if (lineY === null) lineY = y;
    lineText += item.str;
    lineHeight = Math.max(lineHeight, Math.abs(item.height) || 10);
    if (item.hasEOL) {
      lines.push({ text: lineText, y: lineY ?? y, height: lineHeight });
      lineText = "";
      lineY = null;
      lineHeight = 10;
    }
  }
  if (lineText.trim()) lines.push({ text: lineText, y: lineY ?? 0, height: lineHeight });

  const paragraphs: string[] = [];
  let current: string[] = [];
  let prevY: number | null = null;
  let prevHeight = 10;

  for (const line of lines) {
    if (prevY !== null && Math.abs(prevY - line.y) > prevHeight * 1.6) {
      if (current.length) paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [];
    }
    if (line.text.trim()) current.push(line.text.trim());
    prevY = line.y;
    prevHeight = line.height;
  }
  if (current.length) paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());

  return paragraphs.filter(Boolean);
}

export async function extractAllPagesParagraphs(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>
): Promise<string[][]> {
  const result: string[][] = [];
  for (const p of pages) {
    const doc = pdfjsDocs.get(p.sourceId);
    result.push(doc ? await extractPageParagraphs(doc, p.sourcePageIndex) : []);
  }
  return result;
}

export function toPlainText(pagesParagraphs: string[][]): Uint8Array {
  const text = pagesParagraphs.map((paras) => paras.join("\n\n")).join("\n\n\f\n\n");
  return new TextEncoder().encode(text);
}

export function toMarkdown(pagesParagraphs: string[][], title: string): Uint8Array {
  const parts = [`# ${title}`, ""];
  pagesParagraphs.forEach((paras, i) => {
    parts.push(`## Page ${i + 1}`, "");
    for (const para of paras) parts.push(para, "");
  });
  return new TextEncoder().encode(parts.join("\n"));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toHtmlDocument(pagesParagraphs: string[][], title: string): string {
  const body = pagesParagraphs
    .map(
      (paras, i) =>
        `<section class="page" data-page="${i + 1}">\n` +
        paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n") +
        `\n</section>`
    )
    .join("\n<hr/>\n");
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}` +
    `.page{margin-bottom:2rem}hr{border:none;border-top:1px solid #ddd;margin:2rem 0}</style>` +
    `</head><body>${body}</body></html>`
  );
}

export function toHtml(pagesParagraphs: string[][], title: string): Uint8Array {
  return new TextEncoder().encode(toHtmlDocument(pagesParagraphs, title));
}

function escapeRtf(s: string): string {
  const backslashed = s.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
  return Array.from(backslashed)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 127 ? `\\u${code}?` : ch;
    })
    .join("");
}

export function toRtf(pagesParagraphs: string[][]): Uint8Array {
  const body = pagesParagraphs
    .map((paras) => paras.map((p) => `${escapeRtf(p)}\\par`).join("\n"))
    .join("\n\\page\n");
  const text = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs24\n${body}\n}`;
  return new TextEncoder().encode(text);
}

async function renderPageToImageBytes(
  doc: PdfDocumentProxy,
  sourcePageIndex: number,
  rotation: number,
  format: "png" | "jpeg",
  scale: number
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const page = await doc.getPage(sourcePageIndex + 1);
  const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360;
  const viewport = page.getViewport({ scale, rotation: totalRotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), mime, 0.92);
  });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

export async function exportAllPagesAsImages(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  format: "png" | "jpeg",
  scale = 2
): Promise<{ name: string; bytes: Uint8Array; width: number; height: number }[]> {
  const out: { name: string; bytes: Uint8Array; width: number; height: number }[] = [];
  const ext = format === "png" ? "png" : "jpg";
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const doc = pdfjsDocs.get(p.sourceId);
    if (!doc) continue;
    const { bytes, width, height } = await renderPageToImageBytes(doc, p.sourcePageIndex, p.rotation, format, scale);
    out.push({ name: `page-${String(i + 1).padStart(3, "0")}.${ext}`, bytes, width, height });
  }
  return out;
}
