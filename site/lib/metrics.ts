/**
 * Every figure here was measured against a production build of Folio, and the
 * method is published alongside it. Nothing in this file is an estimate — if a
 * claim could not be measured it was left out rather than rounded into shape.
 *
 * Rig: Windows 11, Chromium, 1600x1000 viewport, production `next build`.
 * Timings are the median of three warm runs.
 */
export const measuredAt = "August 2026";

export const metrics = [
  {
    value: "5,000",
    unit: "pages",
    label: "Opens documents this large",
    detail:
      "A 5,000-page, 2.9 MB archive opens and paints its first page in about 5.5 seconds. Page count and outline are available immediately.",
  },
  {
    value: "6",
    unit: "of 10,001",
    label: "Canvases holding a bitmap",
    detail:
      "In that same 5,000-page document only six page canvases carry pixels at any moment. The rest are released as they leave the viewport.",
  },
  {
    value: "7",
    unit: "MB",
    label: "Bitmap memory, flat",
    detail:
      "Total canvas memory stayed at roughly 7 MB after scrolling through 480 viewports — it does not grow with document length.",
  },
  {
    value: "0.9",
    unit: "seconds",
    label: "Typical document to first page",
    detail:
      "A two-page contract renders its first page in about 0.9 seconds, including parsing and text-layer construction.",
  },
] as const;

export const statistics = [
  { value: "100%", label: "Open source" },
  { value: "3", label: "Platforms" },
  { value: "GPL-3.0", label: "Application licence" },
  { value: "Apache-2.0", label: "Engine licence" },
] as const;
