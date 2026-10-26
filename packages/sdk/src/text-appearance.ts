import type { FontFamily } from "./document-model";

/** Bits dropped per channel when binning colors, so antialiased glyph edges fall into few bins. */
const QUANTIZE_SHIFT = 4;
/** Weighted RGB distance above which a bin counts as ink rather than a shade of the background. */
const INK_DISTANCE = 60;
/** Background must hold at least this share of the box, or the box is too varied to read. */
const MIN_BACKGROUND_SHARE = 0.5;
/** Ink must hold at least this share of the box, or the match is noise. */
const MIN_INK_SHARE = 0.1;

export type RunAppearance = {
  /** Hex background behind the run — the patch color needed to cover it. */
  background: string;
  /** Hex color of the run's glyphs. */
  ink: string;
  /**
   * False when the box is too varied for a flat patch to be safe (text over a photo or a
   * gradient) or holds no glyphs. Callers should fall back rather than trust the colors.
   */
  confident: boolean;
};

type Bin = { count: number; r: number; g: number; b: number };

/**
 * Reads the background and glyph colors out of a rasterized text run.
 *
 * Both are needed to reproduce edited text: the background to patch over the original
 * glyphs, the ink to redraw them in. `pixels` is RGBA, row-major, `width * height * 4`
 * long — an `ImageData.data` from the rendered page.
 */
export function sampleRunAppearance(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): RunAppearance {
  const bins = new Map<number, Bin>();
  let sampled = 0;

  for (let i = 0; i + 3 < Math.min(pixels.length, width * height * 4); i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key =
      ((r >> QUANTIZE_SHIFT) << 16) | ((g >> QUANTIZE_SHIFT) << 8) | (b >> QUANTIZE_SHIFT);
    const bin = bins.get(key);
    if (bin) {
      bin.count++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
    } else {
      bins.set(key, { count: 1, r, g, b });
    }
    sampled++;
  }

  if (sampled === 0) return { background: "#ffffff", ink: "#000000", confident: false };

  let background: Bin | null = null;
  for (const bin of bins.values()) {
    if (!background || bin.count > background.count) background = bin;
  }
  const bg = mean(background!);

  let ink: Bin | null = null;
  for (const bin of bins.values()) {
    if (bin === background) continue;
    if (distance(mean(bin), bg) <= INK_DISTANCE) continue;
    if (!ink || bin.count > ink.count) ink = bin;
  }

  const confident =
    background!.count / sampled >= MIN_BACKGROUND_SHARE &&
    ink !== null &&
    ink.count / sampled >= MIN_INK_SHARE;

  return {
    background: toHex(bg),
    ink: ink ? toHex(mean(ink)) : "#000000",
    confident,
  };
}

export type FontDescriptor = { family: FontFamily; bold: boolean; italic: boolean };

/**
 * Classifies a CSS font stack or embedded PDF font name into the standard families the
 * export pipeline can draw with. Exact fidelity would need the source's embedded font;
 * this keeps serif/sans/mono and weight/slant rather than defaulting everything to Helvetica.
 */
export function describeFont(fontFamily: string): FontDescriptor {
  // Subset prefixes ("ABCDEF+Times") and quotes carry no classification signal.
  const name = fontFamily.replace(/^[A-Z]{6}\+/, "").replace(/["']/g, "").toLowerCase();

  // "sans-serif" contains "serif", so sans and mono are ruled out before serif is considered.
  let family: FontFamily = "helvetica";
  if (/mono|courier|consolas|menlo|typewriter/.test(name)) family = "courier";
  else if (/sans/.test(name)) family = "helvetica";
  else if (/serif|times|georgia|garamond|roman|book|minion|cambria|palatino/.test(name))
    family = "times";

  return {
    family,
    bold: /bold|black|heavy|semibold|demi/.test(name),
    italic: /italic|oblique/.test(name),
  };
}

function mean(bin: Bin): { r: number; g: number; b: number } {
  return {
    r: Math.round(bin.r / bin.count),
    g: Math.round(bin.g / bin.count),
    b: Math.round(bin.b / bin.count),
  };
}

/** Rec. 601 luma-weighted RGB distance — closer to perceived difference than a plain norm. */
function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
