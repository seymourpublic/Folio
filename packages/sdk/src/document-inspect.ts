import type { PdfDocumentProxy } from "./pdfjs";

export type JsActionEntry = { source: string; where: string };

export type JsActionReport = {
  hasAny: boolean;
  entries: JsActionEntry[];
  hasFormFieldActions: boolean;
};

/** Reads (never executes) whatever JavaScript is embedded in the document. */
export async function inspectJavaScript(doc: PdfDocumentProxy): Promise<JsActionReport> {
  const [docActions, hasJsActionsFlag] = await Promise.all([
    doc.getJSActions().catch(() => null),
    doc.hasJSActions().catch(() => false),
  ]);

  const entries: JsActionEntry[] = [];
  if (docActions) {
    for (const [name, scripts] of Object.entries(docActions as Record<string, string[]>)) {
      for (const source of scripts) entries.push({ where: name, source });
    }
  }

  const hasFormFieldActions = hasJsActionsFlag && entries.length === 0;
  return { hasAny: entries.length > 0 || hasJsActionsFlag, entries, hasFormFieldActions };
}

export type ColorSpaceReport = {
  hasDeviceCMYK: boolean;
  hasICCBased: boolean;
  iccComponentCounts: number[];
  hasSeparationOrDeviceN: boolean;
  /** True if some streams in the file couldn't be decompressed for scanning (e.g. */
  partialScan: boolean;
};

function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

async function inflateMaybe(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function scanTextForColorSpaces(text: string, report: ColorSpaceReport) {
  if (/\/DeviceCMYK\b/.test(text)) report.hasDeviceCMYK = true;
  if (/\/Separation\b/.test(text)) report.hasSeparationOrDeviceN = true;
  if (/\/DeviceN\b/.test(text)) report.hasSeparationOrDeviceN = true;
  if (/\/ICCBased\b/.test(text)) {
    report.hasICCBased = true;
    const nRegex = /\/N\s+(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = nRegex.exec(text))) {
      const n = Number(m[1]);
      if (n === 1 || n === 3 || n === 4) report.iccComponentCounts.push(n);
    }
  }
}

/** Raw-bytes color-space scan — a regex over the file's own tokens rather than pdf.js's
 * internal operator list, which normalizes CMYK/ICC away during rasterization. Streams are
 * opportunistically inflated and rescanned; `partialScan` reports if any could not be. */
export async function scanColorSpaces(rawBytes: Uint8Array): Promise<ColorSpaceReport> {
  const report: ColorSpaceReport = {
    hasDeviceCMYK: false,
    hasICCBased: false,
    iccComponentCounts: [],
    hasSeparationOrDeviceN: false,
    partialScan: false,
  };

  const text = bytesToLatin1(rawBytes);
  scanTextForColorSpaces(text, report);

  const streamRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  const endToken = "endstream";
  let sawStream = false;
  while ((match = streamRegex.exec(text))) {
    sawStream = true;
    const start = match.index + match[0].length;
    const end = text.indexOf(endToken, start);
    if (end === -1) continue;
    const chunk = rawBytes.subarray(start, end);
    const inflated = await inflateMaybe(chunk);
    if (!inflated) {
      report.partialScan = true;
      continue;
    }
    scanTextForColorSpaces(bytesToLatin1(inflated), report);
  }
  if (!sawStream) report.partialScan = false;

  return report;
}
