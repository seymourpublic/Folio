import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFHexString,
  StandardFonts,
  type PDFPage,
  type PDFFont,
  degrees,
  rgb,
} from "pdf-lib";
import type { Annotation, BookmarkNode, DocPage, DocSource, FontFamily, ImageAnnotation } from "./document-model";
import { wrapText } from "./text-wrap";
import { encryptDocument, type EncryptionOptions } from "./pdf-encrypt";
import { applyBookmarks } from "./outline";
import { applyLinkAnnotations } from "./links";
import { applyFormFieldCreations } from "./form-builder";
import type { PdfDocumentProxy } from "./pdfjs";
import { distanceInPoints, formatDistance } from "./measurement";
import { stampPreset } from "./stamps";
import { embedNotoFonts, needsUnicodeFont, toVisualOrder, type NotoFontSet } from "./unicode-font";
import { embedAuditTrailAttachment, type AuditEvent } from "./audit-trail";

export type WatermarkOptions = {
  text: string;
  opacity: number;
  fontSize: number;
  rotationDeg: number;
  color: string;
};

export type DocumentMetadata = {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
};

export type PageNumberPosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export type PageNumberingOptions = {
  enabled: boolean;
  position: PageNumberPosition;
  format: string;
  startAt: number;
  fontSize: number;
  headerText: string;
  footerText: string;
};

export type CompressOptions = {
  /** Rendering scale used when flattening pages to raster images — lower = smaller file, blurrier text. */
  scale: number;
  /** JPEG quality 0-1. */
  quality: number;
};

export type ExportOptions = {
  watermark?: WatermarkOptions | null;
  encryption?: EncryptionOptions | null;
  metadata?: DocumentMetadata | null;
  bookmarks?: BookmarkNode[];
  pageNumbering?: PageNumberingOptions | null;
  compress?: CompressOptions | null;
  /** Strips Info-dictionary fields, the XMP metadata stream, and randomizes the document ID. */
  scrubMetadata?: boolean;
  /** Embedded as a JSON attachment so activity/signature history travels with the file. */
  auditTrail?: { fileName: string; events: AuditEvent[] } | null;
};

const RASTER_SCALE = 2;

function stripWidgetAnnotations(page: PDFPage) {
  const annotsObj = page.node.get(PDFName.of("Annots"));
  if (!annotsObj) return;
  const annots = page.node.context.lookup(annotsObj, PDFArray);
  if (!annots) return;

  const kept = annots.asArray().filter((entry) => {
    if (!(entry instanceof PDFRef)) return true;
    const dict = page.node.context.lookup(entry, PDFDict);
    const subtype = dict?.get(PDFName.of("Subtype"));
    return subtype?.toString() !== "/Widget";
  });

  page.node.set(PDFName.of("Annots"), page.doc.context.obj(kept));
}

function hexToRgbFraction(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function canvasToBytes(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to rasterize canvas"));
          return;
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      },
      type,
      quality
    );
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Bakes crop/mask/filters (all applied live+non-destructively in the editor) into a flat PNG for export. */
async function bakeImageEdits(ann: ImageAnnotation): Promise<Uint8Array> {
  const img = await loadImageElement(ann.dataUrl);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const crop = ann.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sx = crop.x * naturalWidth;
  const sy = crop.y * naturalHeight;
  const sw = Math.max(1, crop.width * naturalWidth);
  const sh = Math.max(1, crop.height * naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d")!;

  const filters = ann.filters;
  if (filters) {
    ctx.filter = [
      filters.brightness != null ? `brightness(${filters.brightness})` : "",
      filters.contrast != null ? `contrast(${filters.contrast})` : "",
      filters.grayscale ? `grayscale(${filters.grayscale})` : "",
      filters.sepia ? `sepia(${filters.sepia})` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (ann.maskShape === "ellipse") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (ann.maskShape === "rounded") {
    const r = Math.min(canvas.width, canvas.height) * 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, r);
    ctx.clip();
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (ann.maskShape === "ellipse" || ann.maskShape === "rounded") ctx.restore();

  return canvasToBytes(canvas, "image/png");
}

function needsBaking(ann: ImageAnnotation): boolean {
  if (ann.crop) return true;
  if (ann.maskShape && ann.maskShape !== "none") return true;
  const f = ann.filters;
  if (f && (f.brightness != null || f.contrast != null || f.grayscale || f.sepia)) return true;
  return false;
}

/** Anchor + rotate-degrees for pdf-lib's draw calls, offset so rotation visually pivots
 * around the box's center rather than its pre-rotation bottom-left corner. */
function rotatedCornerAnchor(x: number, bottomLeftY: number, width: number, height: number, rotationDeg: number) {
  const phi = (-rotationDeg * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = bottomLeftY + height / 2;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const ax = cx - (width / 2) * cos + (height / 2) * sin;
  const ay = cy - (width / 2) * sin - (height / 2) * cos;
  return { x: ax, y: ay, rotate: degrees(-rotationDeg) };
}

async function rasterizePageToBytes(
  pdfjsDoc: PdfDocumentProxy,
  sourcePageIndex: number,
  rotationDelta: number,
  redactions: Array<{ x: number; y: number; width: number; height: number }>,
  scale: number,
  format: "image/png" | "image/jpeg",
  quality?: number
): Promise<{ bytes: Uint8Array; widthPts: number; heightPts: number }> {
  const page = await pdfjsDoc.getPage(sourcePageIndex + 1);
  const totalRotation = (((page.rotate + rotationDelta) % 360) + 360) % 360;

  const viewport1 = page.getViewport({ scale: 1, rotation: totalRotation });
  const renderViewport = page.getViewport({ scale, rotation: totalRotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  const ctx = canvas.getContext("2d")!;

  if (format === "image/jpeg") {
    // JPEG has no alpha channel — paint a white backdrop first so transparent PDF regions don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;

  ctx.fillStyle = "#000000";
  for (const r of redactions) {
    ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
  }

  const bytes = await canvasToBytes(canvas, format, quality);
  return { bytes, widthPts: viewport1.width, heightPts: viewport1.height };
}

class FontResolver {
  private doc: PDFDocument;
  private standard = new Map<StandardFonts, Promise<PDFFont>>();
  private notoPromise: Promise<NotoFontSet> | null = null;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  private getStandard(name: StandardFonts): Promise<PDFFont> {
    let f = this.standard.get(name);
    if (!f) {
      f = this.doc.embedFont(name);
      this.standard.set(name, f);
    }
    return f;
  }

  private getNoto(): Promise<NotoFontSet> {
    if (!this.notoPromise) this.notoPromise = embedNotoFonts(this.doc);
    return this.notoPromise;
  }

  async resolve(family: FontFamily | undefined, bold: boolean | undefined, italic: boolean | undefined, text: string): Promise<PDFFont> {
    if (family === "noto" || needsUnicodeFont(text)) {
      const set = await this.getNoto();
      if (bold && italic) return set.boldItalic;
      if (bold) return set.bold;
      if (italic) return set.italic;
      return set.regular;
    }
    return this.getStandard(standardFontName(family, bold, italic));
  }
}

function standardFontName(family: FontFamily | undefined, bold?: boolean, italic?: boolean): StandardFonts {
  if (family === "times") {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === "courier") {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

function drawMultilineText(
  page: PDFPage,
  rawText: string,
  opts: {
    x: number;
    topY: number; // baseline of the first line, in pdf-lib (y-up) space
    boxWidth?: number; // when provided, used for alignment; otherwise computed from the widest line
    wrapWidth?: number; // when provided, lines are word-wrapped to this width
    font: PDFFont;
    fontSize: number;
    color: { r: number; g: number; b: number };
    align?: "left" | "center" | "right";
    underline?: boolean;
    direction?: "ltr" | "rtl";
  }
) {
  const source =
    opts.wrapWidth && opts.wrapWidth > 0
      ? wrapText(rawText, opts.wrapWidth, (s) => opts.font.widthOfTextAtSize(s, opts.fontSize)).join("\n")
      : rawText;
  const lines = source.split("\n").map((l) => toVisualOrder(l, opts.direction));
  const lineWidths = lines.map((l) => opts.font.widthOfTextAtSize(l, opts.fontSize));
  const boxWidth = opts.boxWidth ?? Math.max(...lineWidths, 1);
  const align = opts.align ?? (opts.direction === "rtl" ? "right" : "left");
  const lineHeight = opts.fontSize * 1.3;
  const color = rgb(opts.color.r, opts.color.g, opts.color.b);

  lines.forEach((line, i) => {
    const w = lineWidths[i];
    let lineX = opts.x;
    if (align === "center") lineX = opts.x + (boxWidth - w) / 2;
    else if (align === "right") lineX = opts.x + (boxWidth - w);
    const y = opts.topY - i * lineHeight;
    page.drawText(line, { x: lineX, y, size: opts.fontSize, font: opts.font, color });
    if (opts.underline) {
      page.drawLine({
        start: { x: lineX, y: y - opts.fontSize * 0.12 },
        end: { x: lineX + w, y: y - opts.fontSize * 0.12 },
        thickness: Math.max(1, opts.fontSize * 0.06),
        color,
      });
    }
  });
}

async function drawAnnotation(doc: PDFDocument, page: PDFPage, ann: Annotation, pageHeight: number, fonts: FontResolver) {
  const flipY = (y: number) => pageHeight - y;

  switch (ann.type) {
    case "highlight": {
      const c = hexToRgbFraction(ann.color);
      page.drawRectangle({
        x: ann.x,
        y: flipY(ann.y + ann.height),
        width: ann.width,
        height: ann.height,
        color: rgb(c.r, c.g, c.b),
        opacity: 0.4,
      });
      break;
    }
    case "underline":
    case "strikeout": {
      const c = hexToRgbFraction(ann.color);
      const y = ann.type === "underline" ? flipY(ann.y + ann.height) : flipY(ann.y + ann.height / 2);
      page.drawLine({ start: { x: ann.x, y }, end: { x: ann.x + ann.width, y }, thickness: 1.5, color: rgb(c.r, c.g, c.b) });
      break;
    }
    case "squiggly": {
      const c = hexToRgbFraction(ann.color);
      const steps = Math.max(2, Math.ceil(ann.width / 8));
      for (let i = 0; i < steps; i++) {
        const x1 = ann.x + i * 8;
        const x2 = ann.x + (i + 1) * 8;
        const y1 = flipY(ann.y + ann.height - (i % 2 === 0 ? 0 : 5));
        const y2 = flipY(ann.y + ann.height - ((i + 1) % 2 === 0 ? 0 : 5));
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.5, color: rgb(c.r, c.g, c.b) });
      }
      break;
    }
    case "rect": {
      const c = hexToRgbFraction(ann.color);
      page.drawRectangle({
        x: ann.x,
        y: flipY(ann.y + ann.height),
        width: ann.width,
        height: ann.height,
        ...(ann.filled
          ? { color: rgb(c.r, c.g, c.b), opacity: 1 }
          : { borderColor: rgb(c.r, c.g, c.b), borderWidth: ann.strokeWidth ?? 2 }),
      });
      break;
    }
    case "ellipse": {
      const c = hexToRgbFraction(ann.color);
      page.drawEllipse({
        x: ann.x + ann.width / 2,
        y: flipY(ann.y + ann.height / 2),
        xScale: ann.width / 2,
        yScale: ann.height / 2,
        ...(ann.filled
          ? { color: rgb(c.r, c.g, c.b) }
          : { borderColor: rgb(c.r, c.g, c.b), borderWidth: ann.strokeWidth ?? 2 }),
      });
      break;
    }
    case "line":
    case "arrow": {
      const c = hexToRgbFraction(ann.color);
      const start = { x: ann.x1, y: flipY(ann.y1) };
      const end = { x: ann.x2, y: flipY(ann.y2) };
      page.drawLine({ start, end, thickness: ann.strokeWidth, color: rgb(c.r, c.g, c.b) });
      if (ann.type === "arrow") {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const size = 8 + ann.strokeWidth;
        const a1 = angle + Math.PI - 0.45;
        const a2 = angle + Math.PI + 0.45;
        const wing1 = { x: end.x + size * Math.cos(a1), y: end.y + size * Math.sin(a1) };
        const wing2 = { x: end.x + size * Math.cos(a2), y: end.y + size * Math.sin(a2) };
        page.drawLine({ start: end, end: wing1, thickness: ann.strokeWidth, color: rgb(c.r, c.g, c.b) });
        page.drawLine({ start: end, end: wing2, thickness: ann.strokeWidth, color: rgb(c.r, c.g, c.b) });
      }
      break;
    }
    case "measurement": {
      const c = hexToRgbFraction(ann.color);
      const start = { x: ann.x1, y: flipY(ann.y1) };
      const end = { x: ann.x2, y: flipY(ann.y2) };
      page.drawLine({ start, end, thickness: 1.2, color: rgb(c.r, c.g, c.b) });
      const label = formatDistance(distanceInPoints(ann.x1, ann.y1, ann.x2, ann.y2), ann.unit);
      const font = await fonts.resolve(undefined, false, false, label);
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const w = font.widthOfTextAtSize(label, 9);
      page.drawRectangle({ x: midX - w / 2 - 2, y: midY - 2, width: w + 4, height: 11, color: rgb(1, 1, 1), opacity: 0.85 });
      page.drawText(label, { x: midX - w / 2, y: midY, size: 9, font, color: rgb(c.r, c.g, c.b) });
      break;
    }
    case "ink": {
      if (ann.points.length < 2) break;
      const c = hexToRgbFraction(ann.color);
      for (let i = 0; i < ann.points.length - 1; i++) {
        const p1 = ann.points[i];
        const p2 = ann.points[i + 1];
        page.drawLine({
          start: { x: p1.x, y: flipY(p1.y) },
          end: { x: p2.x, y: flipY(p2.y) },
          thickness: ann.strokeWidth,
          color: rgb(c.r, c.g, c.b),
        });
      }
      break;
    }
    case "text": {
      const c = hexToRgbFraction(ann.color);
      const font = await fonts.resolve(ann.fontFamily, ann.bold, ann.italic, ann.text);
      drawMultilineText(page, ann.text, {
        x: ann.x,
        topY: flipY(ann.y) - ann.fontSize,
        font,
        fontSize: ann.fontSize,
        color: c,
        align: ann.align,
        underline: ann.underline,
        direction: ann.direction,
      });
      break;
    }
    case "callout": {
      const c = hexToRgbFraction(ann.color);
      const boxY = flipY(ann.y + ann.height);
      page.drawRectangle({ x: ann.x, y: boxY, width: ann.width, height: ann.height, color: rgb(1, 1, 1), borderColor: rgb(c.r, c.g, c.b), borderWidth: 1 });
      const boxCenter = { x: ann.x + ann.width / 2, y: boxY + ann.height / 2 };
      page.drawLine({ start: { x: ann.pointerX, y: flipY(ann.pointerY) }, end: boxCenter, thickness: 1.2, color: rgb(c.r, c.g, c.b) });
      const font = await fonts.resolve(ann.fontFamily, ann.bold, ann.italic, ann.text);
      drawMultilineText(page, ann.text, {
        x: ann.x + 4,
        topY: flipY(ann.y) - ann.fontSize - 4,
        boxWidth: ann.width - 8,
        font,
        fontSize: ann.fontSize,
        color: c,
        align: ann.align,
        direction: ann.direction,
      });
      break;
    }
    case "note": {
      const w = 180;
      const h = 70;
      page.drawRectangle({
        x: ann.x,
        y: flipY(ann.y + h),
        width: w,
        height: h,
        color: rgb(1, 0.93, 0.4),
        opacity: 1,
        borderColor: rgb(0.75, 0.65, 0),
        borderWidth: 1,
      });
      const font = await fonts.resolve(undefined, false, false, ann.text);
      page.drawText(ann.text, {
        x: ann.x + 8,
        y: flipY(ann.y + 20),
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: w - 16,
        lineHeight: 11,
      });
      break;
    }
    case "image": {
      const bytes = needsBaking(ann) ? await bakeImageEdits(ann) : dataUrlToBytes(ann.dataUrl);
      const isPng = needsBaking(ann) || ann.dataUrl.startsWith("data:image/png");
      const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const rotation = ann.rotation ?? 0;
      if (rotation) {
        const anchor = rotatedCornerAnchor(ann.x, flipY(ann.y + ann.height), ann.width, ann.height, rotation);
        page.drawImage(img, { x: anchor.x, y: anchor.y, width: ann.width, height: ann.height, rotate: anchor.rotate, opacity: ann.opacity ?? 1 });
      } else {
        page.drawImage(img, { x: ann.x, y: flipY(ann.y + ann.height), width: ann.width, height: ann.height, opacity: ann.opacity ?? 1 });
      }
      break;
    }
    case "stamp": {
      if (ann.dataUrl) {
        const bytes = dataUrlToBytes(ann.dataUrl);
        const isPng = ann.dataUrl.startsWith("data:image/png");
        const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        page.drawImage(img, { x: ann.x, y: flipY(ann.y + ann.height), width: ann.width, height: ann.height });
      } else {
        const preset = stampPreset(ann.presetId);
        const color = hexToRgbFraction(ann.color ?? preset?.color ?? "#dc2626");
        const label = ann.label ?? preset?.label ?? "STAMP";
        const anchor = rotatedCornerAnchor(ann.x, flipY(ann.y + ann.height), ann.width, ann.height, -6);
        page.drawRectangle({
          x: anchor.x,
          y: anchor.y,
          width: ann.width,
          height: ann.height,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 3,
          rotate: anchor.rotate,
        });
        const font = await fonts.resolve("helvetica", true, false, label);
        const fontSize = Math.max(10, Math.min(20, ann.height * 0.35));
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const textAnchor = rotatedCornerAnchor(
          ann.x + (ann.width - textWidth) / 2,
          flipY(ann.y + ann.height / 2 + fontSize * 0.35),
          textWidth,
          fontSize,
          -6
        );
        page.drawText(label, {
          x: textAnchor.x,
          y: textAnchor.y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          rotate: textAnchor.rotate,
        });
      }
      break;
    }
    case "form-field": {
      if (ann.fieldKind === "checkbox" || ann.fieldKind === "radio") {
        if (ann.value) {
          const size = Math.min(ann.width, ann.height) * 0.7;
          page.drawText("X", {
            x: ann.x + (ann.width - size * 0.6) / 2,
            y: flipY(ann.y + ann.height / 2 + size * 0.35),
            size,
            color: rgb(0.1, 0.1, 0.1),
          });
        }
      } else if (ann.value) {
        const fontSize = Math.max(8, Math.min(14, ann.height * 0.6));
        page.drawText(ann.value, {
          x: ann.x + 2,
          y: flipY(ann.y + ann.height / 2 + fontSize * 0.35),
          size: fontSize,
          color: rgb(0.05, 0.05, 0.4),
          maxWidth: ann.width - 4,
        });
      }
      break;
    }
    case "text-edit": {
      const patch = ann.backgroundColor ? hexToRgbFraction(ann.backgroundColor) : { r: 1, g: 1, b: 1 };
      page.drawRectangle({
        x: ann.x,
        y: flipY(ann.y + ann.height),
        width: ann.width,
        height: ann.height,
        color: rgb(patch.r, patch.g, patch.b),
      });
      const c = hexToRgbFraction(ann.color);
      const font = await fonts.resolve(ann.fontFamily, ann.bold, ann.italic, ann.newText);
      drawMultilineText(page, ann.newText, {
        x: ann.x,
        topY: flipY(ann.y) - ann.fontSize,
        boxWidth: ann.width,
        wrapWidth: ann.width,
        font,
        fontSize: ann.fontSize,
        color: c,
      });
      break;
    }
    case "redact":
      // Burned into the page raster by rasterizePageToBytes; nothing to draw here.
      break;
    case "link":
      break;
    case "form-field-create":
      break;
  }
}

async function loadSourceDocs(sources: Map<string, DocSource>) {
  const loaded = new Map<string, PDFDocument>();
  for (const source of sources.values()) {
    loaded.set(source.id, await PDFDocument.load(source.bytes, { ignoreEncryption: true }));
  }
  return loaded;
}

function drawWatermark(page: PDFPage, watermark: WatermarkOptions, font: PDFFont) {
  const c = hexToRgbFraction(watermark.color);
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(watermark.text, watermark.fontSize);
  page.drawText(watermark.text, {
    x: width / 2 - textWidth / 2,
    y: height / 2,
    size: watermark.fontSize,
    font,
    color: rgb(c.r, c.g, c.b),
    opacity: watermark.opacity,
    rotate: degrees(watermark.rotationDeg),
  });
}

const MARGIN = 28;

function drawAt(
  page: PDFPage,
  text: string,
  position: PageNumberPosition | "top-center" | "bottom-center",
  font: PDFFont,
  fontSize: number
) {
  if (!text) return;
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const isTop = position.startsWith("top");
  const y = isTop ? height - MARGIN : MARGIN;

  let x = width / 2 - textWidth / 2;
  if (position.endsWith("left")) x = MARGIN;
  else if (position.endsWith("right")) x = width - MARGIN - textWidth;

  page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
}

function drawPageNumbering(
  page: PDFPage,
  options: PageNumberingOptions,
  font: PDFFont,
  pageIndex: number,
  totalPages: number
) {
  if (options.headerText) drawAt(page, options.headerText, "top-center", font, options.fontSize);
  if (options.footerText) drawAt(page, options.footerText, "bottom-center", font, options.fontSize);

  if (options.enabled) {
    const n = options.startAt + pageIndex;
    const label = options.format.replace("{n}", String(n)).replace("{total}", String(totalPages));
    drawAt(page, label, options.position, font, options.fontSize);
  }
}

function drawOcrTextLayer(page: PDFPage, docPage: DocPage, font: PDFFont, pageHeight: number) {
  if (!docPage.ocrWords?.length) return;
  const flipY = (y: number) => pageHeight - y;
  for (const word of docPage.ocrWords) {
    try {
      page.drawText(word.text, {
        x: word.x,
        y: flipY(word.y + word.height),
        size: word.height,
        font,
        opacity: 0,
      });
    } catch {
      // Skip words with characters unsupported by the embedded font rather than failing the whole export.
    }
  }
}

export async function exportDocument(
  pages: DocPage[],
  sources: Map<string, DocSource>,
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  options?: ExportOptions
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  const loadedSourceDocs = await loadSourceDocs(sources);
  const fonts = new FontResolver(output);

  const watermarkFont = options?.watermark ? await output.embedFont(StandardFonts.HelveticaBold) : null;
  const hasOcr = pages.some((p) => p.ocrWords?.length);
  const ocrFont = hasOcr ? await output.embedFont(StandardFonts.Helvetica) : null;
  const pageNumberFont = options?.pageNumbering ? await output.embedFont(StandardFonts.Helvetica) : null;

  for (const [pageIndex, docPage] of pages.entries()) {
    const sourceDoc = loadedSourceDocs.get(docPage.sourceId);
    const pdfjsDoc = pdfjsDocs.get(docPage.sourceId);
    if (!sourceDoc) continue;

    const redactions = docPage.annotations.filter((a) => a.type === "redact");
    const shouldRasterize = (redactions.length > 0 || options?.compress) && pdfjsDoc;
    let page: PDFPage;

    if (shouldRasterize && pdfjsDoc) {
      const format = options?.compress ? "image/jpeg" : "image/png";
      const scale = options?.compress?.scale ?? RASTER_SCALE;
      const { bytes, widthPts, heightPts } = await rasterizePageToBytes(
        pdfjsDoc,
        docPage.sourcePageIndex,
        docPage.rotation,
        redactions,
        scale,
        format,
        options?.compress?.quality
      );
      page = output.addPage([widthPts, heightPts]);
      const img = format === "image/jpeg" ? await output.embedJpg(bytes) : await output.embedPng(bytes);
      page.drawImage(img, { x: 0, y: 0, width: widthPts, height: heightPts });
    } else {
      const [copiedPage] = await output.copyPages(sourceDoc, [docPage.sourcePageIndex]);
      output.addPage(copiedPage);
      page = copiedPage;

      const baseRotation = page.getRotation().angle;
      page.setRotation(degrees((baseRotation + docPage.rotation) % 360));
    }

    const { height } = page.getSize();
    for (const ann of docPage.annotations) {
      if (ann.type === "redact") continue;
      await drawAnnotation(output, page, ann, height, fonts);
    }

    if (ocrFont) drawOcrTextLayer(page, docPage, ocrFont, height);

    stripWidgetAnnotations(page);

    if (options?.watermark && watermarkFont) {
      drawWatermark(page, options.watermark, watermarkFont);
    }

    if (options?.pageNumbering && pageNumberFont) {
      drawPageNumbering(page, options.pageNumbering, pageNumberFont, pageIndex, pages.length);
    }
  }

  if (options?.metadata) {
    const { title, author, subject, keywords } = options.metadata;
    if (title) output.setTitle(title);
    if (author) output.setAuthor(author);
    if (subject) output.setSubject(subject);
    if (keywords.length) output.setKeywords(keywords);
  }

  if (options?.scrubMetadata) {
    // Drop the whole Info dictionary and XMP stream, then randomize the document ID so the
    // file can't be correlated by it either.
    output.context.trailerInfo.Info = undefined;
    output.catalog.delete(PDFName.of("Metadata"));
    const freshId = crypto.getRandomValues(new Uint8Array(16));
    const freshIdHex = Array.from(freshId)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    output.context.trailerInfo.ID = output.context.obj([PDFHexString.of(freshIdHex), PDFHexString.of(freshIdHex)]);
  }

  applyLinkAnnotations(output, pages);
  applyFormFieldCreations(output, pages);

  if (options?.bookmarks?.length) {
    applyBookmarks(output, options.bookmarks, pages);
  }

  if (options?.auditTrail?.events.length && !options.scrubMetadata) {
    await embedAuditTrailAttachment(output, options.auditTrail.events, options.auditTrail.fileName);
  }

  if (options?.encryption) {
    await encryptDocument(output, options.encryption);
    return output.save({ useObjectStreams: false });
  }

  return output.save();
}

export async function extractPagesAsPdf(
  pageIds: string[],
  allPages: DocPage[],
  sources: Map<string, DocSource>,
  pdfjsDocs: Map<string, PdfDocumentProxy>
): Promise<Uint8Array> {
  const selected = allPages.filter((p) => pageIds.includes(p.id));
  return exportDocument(selected, sources, pdfjsDocs);
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType = "application/pdf") {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
