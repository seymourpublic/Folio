import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

export type NotoFontSet = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

const FONT_PATHS = {
  regular: "/fonts/NotoSans-Regular.ttf",
  bold: "/fonts/NotoSans-Bold.ttf",
  italic: "/fonts/NotoSans-Italic.ttf",
  boldItalic: "/fonts/NotoSans-BoldItalic.ttf",
} as const;

const byteCache = new Map<string, Promise<ArrayBuffer>>();

function fetchFontBytes(path: string): Promise<ArrayBuffer> {
  let cached = byteCache.get(path);
  if (!cached) {
    cached = fetch(path).then((res) => res.arrayBuffer());
    byteCache.set(path, cached);
  }
  return cached;
}

/** Embeds Noto Sans (regular/bold/italic/bold-italic) into `doc` via fontkit. */
export async function embedNotoFonts(doc: PDFDocument): Promise<NotoFontSet> {
  doc.registerFontkit(fontkit);
  const [regular, bold, italic, boldItalic] = await Promise.all([
    fetchFontBytes(FONT_PATHS.regular),
    fetchFontBytes(FONT_PATHS.bold),
    fetchFontBytes(FONT_PATHS.italic),
    fetchFontBytes(FONT_PATHS.boldItalic),
  ]);
  const [regularFont, boldFont, italicFont, boldItalicFont] = await Promise.all([
    doc.embedFont(regular, { subset: true }),
    doc.embedFont(bold, { subset: true }),
    doc.embedFont(italic, { subset: true }),
    doc.embedFont(boldItalic, { subset: true }),
  ]);
  return { regular: regularFont, bold: boldFont, italic: italicFont, boldItalic: boldItalicFont };
}

/** True if `text` contains any character pdf-lib's WinAnsi standard fonts can't encode. */
export function needsUnicodeFont(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0xff) return true;
  }
  return false;
}

/** Reverses codepoint order for simple (non-mixed) RTL strings so pdf-lib's left-to-right
 * placement reads correctly. No Arabic contextual shaping — Arabic uses isolated forms. */
export function toVisualOrder(text: string, direction: "ltr" | "rtl" | undefined): string {
  if (direction !== "rtl") return text;
  return Array.from(text).reverse().join("");
}
