# @folio/engine

A framework-agnostic PDF engine — rendering, editing, conversion, OCR, signing, search —
extracted from [Folio](../../README.md), a document workspace app. No React/Next dependency;
usable from any web app, Electron app, or (for the non-visual parts) a plain Node backend.

> **Status**: extracted from Folio, pre-1.0, not yet published to npm. The package name
> `@folio/engine` is a placeholder — rename it before any real publish.

## Install

```
npm install @folio/engine
```

## Setup (read this first)

Two of this engine's dependencies — **pdf.js** (rendering) and **tesseract.js** (OCR) — load
extra worker/wasm assets at runtime, and where those assets live depends on your bundler. Call
`configureEngine()` once at app startup, before loading any PDF or running OCR:

```ts
import { configureEngine } from "@folio/engine";

configureEngine({
  // Copy node_modules/pdfjs-dist/build/pdf.worker.min.mjs into your own static assets
  // directory and point this at it. Without an explicit value this defaults to fetching
  // from unpkg — fine for prototyping, not for production (offline use, CSP, version drift).
  pdfWorkerSrc: "/assets/pdf.worker.min.mjs",

  // Optional — omit to let tesseract.js use its own v7 defaults. Set these to self-host
  // OCR assets instead (recommended for production, offline use, or Electron).
  tesseract: {
    workerPath: "/assets/tesseract/worker.min.js",
    corePath: "/assets/tesseract/tesseract-core.wasm.js",
    langPath: "/assets/tesseract/lang-data",
  },
});
```

## Quick start

```ts
import { loadPdfDocument, extractAllPagesParagraphs, exportDocument, pagesFromSource, createId } from "@folio/engine";

const bytes = await fetch("/sample.pdf").then((r) => r.arrayBuffer());
const doc = await loadPdfDocument(bytes);

const sourceId = createId();
const pages = pagesFromSource(sourceId, doc.numPages);
const sources = new Map([[sourceId, { id: sourceId, name: "sample.pdf", bytes }]]);
const pdfjsDocs = new Map([[sourceId, doc]]);

const paragraphs = await extractAllPagesParagraphs(pages, pdfjsDocs);
console.log(paragraphs.flat().join("\n"));

// pages/annotations are plain data — edit the DocPage[] array however you like, then export.
const editedBytes = await exportDocument(pages, sources, pdfjsDocs);
```

## Environment requirements

| Domain | Requires |
| --- | --- |
| Core model, `convert.ts` text exporters (`toPlainText`/`toMarkdown`/`toHtml`/`toRtf`), signing, encryption, PKI | Any JS environment (Node, browser, Electron) |
| Rendering/export, page-image export, visual compare, SVG export, barcode detection, OCR | Browser or Electron renderer (DOM + Canvas; OCR additionally needs Web Workers) |

`downloadBytes()` in the rendering/export domain specifically requires `Blob`/`document.createElement("a")` and is browser-only even within that domain.

## API overview

Everything is available from the main entry point. Three domains with heavier/optional
dependencies are also available as dedicated subpaths, for consumers who want a tighter bundle
(they're re-exported from the main entry too — the subpaths are optional, not required):

- **`@folio/engine`** — core document model (`DocPage`, `Annotation`, `Tool`, `DocSource`,
  `BookmarkNode`, `ViewMode`, `createId`, `pagesFromSource`), document loading
  (`loadPdfDocument`), rendering/export (`exportDocument`, `exportPageAsSvg`, bookmarks, links,
  watermarks, page numbering, form-field baking, Unicode font embedding), editing/inspection
  (page splitting/grouping, visual/text compare, JS-action and color-space inspection,
  embedded-media detection, measurement, accessibility structure-tree inspection), forms
  (`getFormFieldsForPage`, form-data import/export as JSON/FDF/XFDF), and search
  (`searchDocument`, `searchEverything`).
- **`@folio/engine/convert`** — `toDocx`, `toEpub`, `toPptx`, `toPlainText`/`toMarkdown`/`toHtml`/`toRtf`, `exportAsXlsx`, `exportAllPagesAsImages`.
- **`@folio/engine/ocr`** — `ocrPage`, OCR pre-processing (deskew/denoise), barcode detection (`detectBarcodesOnCanvas`, `scanDocumentForBarcodes`).
- **`@folio/engine/signing`** — PDF standard-security encryption/decryption (`encryptDocument`, `decryptDocument`, `decryptPdfBytes`), certificate-based signing and verification (`signPdfWithCertificate`, `verifyPdfSignatures`), certificate generation/import (`generateSelfSignedCertificate`, `importPkcs12`, `certInfo`), and RFC 3161 timestamping (`requestTimestamp`, `embedTimestampToken`).

None of these modules persist anything on their own (no IndexedDB, no localStorage, no
filesystem writes) — they're pure functions operating on bytes and in-memory data you pass in
and get back. Persistence (a document library, autosave, certificate storage, version history,
audit logs) is left to the host application; see `smoke/` in this package for worked examples
of wiring the engine up end-to-end.

## Development

```
npm run typecheck   # tsc --noEmit
npm run build        # tsup — dual ESM/CJS + .d.ts, one entry per subpath
npm run smoke         # Tier A (plain Node) + Tier B (Playwright/Chromium) smoke tests
npm test               # typecheck -> build -> smoke
```

OCR/barcode recognition is not exercised in the automated smoke tests (network-dependent asset
downloads and inconsistent `BarcodeDetector` browser support make it flaky as a gate) — verify
those manually against a real document if you change `ocr.ts`/`ocr-preprocess.ts`/`barcode.ts`.
