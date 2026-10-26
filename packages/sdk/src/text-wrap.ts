/**
 * Greedily wraps `text` to lines no wider than `maxWidth`, measuring with `measure`
 * (`PDFFont.widthOfTextAtSize` bound to a size, in the caller's units).
 *
 * Explicit newlines are kept as hard breaks. A single word too long for a line is broken
 * mid-word, so no line can exceed `maxWidth` and overflow the box it was laid out for.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];

  for (const hardLine of text.split("\n")) {
    if (measure(hardLine) <= maxWidth) {
      lines.push(hardLine);
      continue;
    }

    let current = "";
    for (const word of hardLine.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }
      // The word alone overflows: break it at the last character that still fits.
      let chunk = "";
      for (const char of word) {
        if (chunk && measure(chunk + char) > maxWidth) {
          lines.push(chunk);
          chunk = "";
        }
        chunk += char;
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }

  return lines;
}
