# Folio website

The marketing and documentation site for [Folio](https://github.com/naledisandamela/folio) — a Next.js 16 App Router app, styled with Tailwind CSS v4.

This directory is self-contained and intended to live in its own repository. Move it out and it runs as-is.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

> While this folder still sits inside the application repository, it has no `node_modules` of its own. Run `npm install` here first — the root repository's dependencies are not shared, and `turbopack.root` is pinned to this directory.

## Structure

```
app/
  page.tsx              Landing page
  download/             Download page
  roadmap/              Roadmap
  docs/                 Documentation, with its own sidebar layout
    installation/
    user-guide/
    keyboard-shortcuts/
    faq/
    troubleshooting/
components/
  button.tsx            Primary / secondary / ghost
  screenshot.tsx        Product capture, no browser or device chrome
  hero-media.tsx        Looping recording, paused until visible
  reveal.tsx            Fade up 8px on entry, once
  count-up.tsx          Statistics, counted once
lib/
  site.ts               Repo URLs, version, navigation, platforms
  metrics.ts            Measured performance figures
  shortcuts.ts          Mirror of the app's shortcut manifest
  use-reduced-motion.ts Shared motion preference
public/                 Screenshots and the hero recording
```

## Design rules

The site is meant to read like the product: precise, calm, technical. A few rules hold it together.

- **Whitespace does the work.** Sections are `py-section` (120px), cards `p-card` (32px), text groups 24px. Never tighten these to fit more in.
- **One accent.** Blue is used deliberately and sparingly. Primary buttons are near-black, not blue.
- **Motion explains, never decorates.** Entry is a fade with an 8px rise, 150–250ms. Hover lifts 2px. Nothing bounces, nothing parallaxes, nothing repeats after it has been seen once.
- **No mockups.** Screenshots are the real application at full resolution — no browser frames, no laptop renders, no invented dashboards.
- **No decorative illustration.** No gradients, glass, floating shapes or stock imagery. If something needs illustrating, use a real screenshot, real code, or a real changelog entry.

## Things to keep in sync

**`lib/site.ts`** holds the repository URL, the current version and the platform download filenames. Update `version` when a release is tagged.

**`lib/metrics.ts`** holds the performance figures on the homepage. Every one is measured, and the method is printed on the page. **If you cannot measure a claim, do not add it** — that section only works because it is true.

**`lib/shortcuts.ts`** mirrors `src/lib/commands/shortcut-manifest.ts` in the application repository. If a binding changes there, change it here too — the shortcuts documentation page reads from this file.

**Media in `public/`** is captured from a production build of the app:

| Asset | How it was made |
| --- | --- |
| `shot-*.png` | 1180×740 viewport, device scale factor 2. The tighter viewport keeps the interface legible at column width. |
| `screenshot-workspace*.png` | 1600×1000 at 2x, used by the repository README. |
| `hero.webm` | A ~13s scripted interaction recorded with Playwright, trimmed so the last frame matches the first and the loop is seamless. |
| `hero-poster.png` | First frame of the recording; also the still shown under reduced motion. |

Recapture when the interface changes noticeably.

## Theming

Colour tokens are defined in `app/globals.css`. Both light and dark are supported; an inline script in `app/layout.tsx` applies the stored preference before first paint, and `components/theme-toggle.tsx` reapplies it after hydration — React reconciles `<html class>` during hydration and would otherwise drop it.

Client-only state (theme, platform, reduced motion) is read through `useSyncExternalStore` rather than a post-mount `setState`, which keeps the server and the client's first render in agreement.

## Deployment

Deploys to Vercel with no configuration. Every route is static.
