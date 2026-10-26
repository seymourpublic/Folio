import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFString, PDFHexString, type PDFContext } from "pdf-lib";
import * as pako from "pako";

export type EmbeddedMedia = {
  id: string;
  pageIndex: number;
  /** Annotation rect in PDF page space: [x0, y0, x1, y1], origin bottom-left. */
  rect: [number, number, number, number];
  kind: "video" | "audio";
  mimeType: string;
  bytes: Uint8Array;
};

const EXTENSION_MIME_TYPES: Record<string, { mime: string; kind: "video" | "audio" }> = {
  mp4: { mime: "video/mp4", kind: "video" },
  m4v: { mime: "video/mp4", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  ogv: { mime: "video/ogg", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
  mp3: { mime: "audio/mpeg", kind: "audio" },
  wav: { mime: "audio/wav", kind: "audio" },
  m4a: { mime: "audio/mp4", kind: "audio" },
  oga: { mime: "audio/ogg", kind: "audio" },
  ogg: { mime: "audio/ogg", kind: "audio" },
};

function guessMediaTypeFromFilename(filename: string | undefined): { mime: string; kind: "video" | "audio" } {
  const ext = filename?.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_MIME_TYPES[ext]) || { mime: "video/mp4", kind: "video" };
}

function asDict(context: PDFContext, value: unknown): PDFDict | undefined {
  if (value === undefined) return undefined;
  return context.lookupMaybe(value as never, PDFDict);
}

function asString(value: unknown): string | undefined {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return undefined;
}

/** Decodes a stream's contents, inflating FlateDecode-filtered data (the only filter that applies to raw embedded media bytes). */
function decodeStreamContents(stream: PDFStream): Uint8Array {
  const raw = stream.getContents();
  const filter = stream.dict.get(PDFName.of("Filter"));
  const filterNames = filter instanceof PDFArray
    ? Array.from({ length: filter.size() }, (_, i) => filter.get(i)?.toString())
    : filter
      ? [filter.toString()]
      : [];

  let bytes = raw;
  for (const name of filterNames) {
    if (name === "/FlateDecode" || name === "/Fl") {
      try {
        bytes = pako.inflate(bytes);
      } catch {
      }
    }
  }
  return bytes;
}

/** Reads an embedded file's raw bytes out of a PDF File Specification dictionary (§7.11). */
function extractFileSpecBytes(
  context: PDFContext,
  fileSpec: PDFDict | undefined
): { bytes: Uint8Array; filename?: string } | null {
  if (!fileSpec) return null;
  const ef = asDict(context, fileSpec.get(PDFName.of("EF")));
  const streamRef = ef?.get(PDFName.of("F"));
  if (!streamRef) return null;
  const stream = context.lookupMaybe(streamRef as never, PDFStream);
  if (!stream) return null;
  const filename = asString(fileSpec.get(PDFName.of("UF"))) ?? asString(fileSpec.get(PDFName.of("F")));
  return { bytes: decodeStreamContents(stream), filename };
}

function extractFromMovieAnnotation(context: PDFContext, annotDict: PDFDict): { bytes: Uint8Array; filename?: string } | null {
  const movie = asDict(context, annotDict.get(PDFName.of("Movie")));
  const fileSpec = asDict(context, movie?.get(PDFName.of("F")));
  return extractFileSpecBytes(context, fileSpec);
}

function extractFromScreenAnnotation(context: PDFContext, annotDict: PDFDict): { bytes: Uint8Array; filename?: string } | null {
  let action = asDict(context, annotDict.get(PDFName.of("A")));
  if (!action) {
    const aa = asDict(context, annotDict.get(PDFName.of("AA")));
    action = asDict(context, aa?.get(PDFName.of("PO")));
  }
  if (!action) return null;

  const rendition = asDict(context, action.get(PDFName.of("R")));
  const mediaClip = asDict(context, rendition?.get(PDFName.of("C")));
  const fileSpec = asDict(context, mediaClip?.get(PDFName.of("D")));
  return extractFileSpecBytes(context, fileSpec);
}

function rectFromAnnotation(context: PDFContext, annotDict: PDFDict): [number, number, number, number] | null {
  const rectArray = context.lookupMaybe(annotDict.get(PDFName.of("Rect")), PDFArray);
  if (!rectArray || rectArray.size() < 4) return null;
  const nums = Array.from({ length: 4 }, (_, i) => {
    const entry = context.lookup(rectArray.get(i));
    return entry && "asNumber" in entry ? (entry as { asNumber(): number }).asNumber() : 0;
  });
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Extracts embedded video/audio from Movie (§12.5.6.15) and Screen+Rendition (§12.5.6.18,
 * §13.2) annotations. Covers the directly-embedded case only, not URL-referenced clip data.
 */
export async function findEmbeddedMedia(bytes: ArrayBuffer | Uint8Array): Promise<EmbeddedMedia[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const context = doc.context;
  const results: EmbeddedMedia[] = [];

  const pageCount = doc.getPageCount();
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = doc.getPage(pageIndex);
    const annots = page.node.Annots();
    if (!annots) continue;

    for (let i = 0; i < annots.size(); i++) {
      const annotDict = context.lookupMaybe(annots.get(i), PDFDict);
      if (!annotDict) continue;
      const subtype = annotDict.get(PDFName.of("Subtype"))?.toString();

      let extracted: { bytes: Uint8Array; filename?: string } | null = null;
      if (subtype === "/Movie") extracted = extractFromMovieAnnotation(context, annotDict);
      else if (subtype === "/Screen") extracted = extractFromScreenAnnotation(context, annotDict);
      if (!extracted) continue;

      const rect = rectFromAnnotation(context, annotDict);
      if (!rect) continue;

      const { mime, kind } = guessMediaTypeFromFilename(extracted.filename);
      results.push({
        id: `${pageIndex}-${i}`,
        pageIndex,
        rect,
        kind,
        mimeType: mime,
        bytes: extracted.bytes,
      });
    }
  }

  return results;
}
