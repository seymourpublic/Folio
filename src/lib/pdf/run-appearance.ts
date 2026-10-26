import { sampleRunAppearance, describeFont, type FontFamily } from "@folio/engine";

export type RunStyle = {
  /** Sampled colors, or undefined when the run's box was too varied to read safely. */
  appearance?: { background: string; ink: string };
  font: { family: FontFamily; bold: boolean; italic: boolean };
};

/**
 * Reads the colors and font of a rendered text run, for reproducing it after an edit.
 *
 * Shared by the two paths that create text-edit annotations — clicking a run in edit-text
 * mode, and find-and-replace. `originRect` must be the box `spanRect` is measured against
 * and must line up with the canvas's CSS box.
 */
export function readRunStyle(opts: {
  canvas: HTMLCanvasElement | null | undefined;
  span: HTMLElement;
  originRect: DOMRect;
  spanRect: DOMRect;
}): RunStyle {
  return {
    appearance: sampleCanvas(opts.canvas, opts.originRect, opts.spanRect),
    font: describeFont(getComputedStyle(opts.span).fontFamily),
  };
}

function sampleCanvas(
  canvas: HTMLCanvasElement | null | undefined,
  originRect: DOMRect,
  spanRect: DOMRect
): RunStyle["appearance"] {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx || canvas.width === 0) return undefined;

  // The backing store is scaled by devicePixelRatio relative to the CSS box the rects use.
  const ratio = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
  const sx = Math.max(0, Math.floor((spanRect.left - originRect.left) * ratio));
  const sy = Math.max(0, Math.floor((spanRect.top - originRect.top) * ratio));
  const sw = Math.min(canvas.width - sx, Math.ceil(spanRect.width * ratio));
  const sh = Math.min(canvas.height - sy, Math.ceil(spanRect.height * ratio));
  if (sw <= 0 || sh <= 0) return undefined;

  try {
    const { data } = ctx.getImageData(sx, sy, sw, sh);
    const sampled = sampleRunAppearance(data, sw, sh);
    return sampled.confident ? { background: sampled.background, ink: sampled.ink } : undefined;
  } catch {
    return undefined; // Reading a tainted canvas throws; fall back to the defaults.
  }
}
