# Changelog

All notable changes to Folio are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source project documentation: `README`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue and pull request templates
- Licensing: GPL-3.0-or-later for the application, Apache-2.0 for `@folio/engine`
- Documentation site under `site/`

### Changed

- Renamed the package from `acrobat-clone` to `folio`; the Electron app ID is now `com.folio.app`
- Tightened source comments throughout — narrative commentary removed, spec citations and rationale kept

## [0.1.0] — 2026-10-26

The first release. Everything below is implemented and working.

### Distribution

- Windows NSIS installer (`npm run electron:installer:win`) with a choice of install folder and desktop and Start menu shortcuts

### Viewing

- Multi-tab workspace with split view and drag-to-reorder tabs
- Virtualized page rendering with off-screen bitmap release
- Continuous and single-page scrolling, reading mode
- Outline, bookmarks, thumbnails, layers (OCG), attachments
- Zoom presets, fit-to-width, page rotation
- Navigation history, command palette (<kbd>Ctrl/⌘</kbd>+<kbd>K</kbd>)

### Annotation

- Highlight, underline, strikeout, squiggly markup
- Freehand ink, shapes, arrows, stamps
- Sticky notes and text boxes
- Measurement tools
- Threaded comments panel with @mentions

### Editing

- In-place text editing over existing glyphs
- Image insertion and replacement
- Page reorder, rotate, insert, delete
- Merge, split, compress
- Watermarks, headers and footers, page numbers
- Visual page comparison and near-duplicate detection

### Forms

- AcroForm field filling
- Field creation: text, checkbox, radio group, dropdown
- Calculation, validation and format rules emitted as Acrobat core-JS actions
- Form data import and export

### Security

- AES-128 (R4) and AES-256 (R6) encryption with permission flags
- Redaction with real content removal
- Metadata and XMP scrubbing with document ID randomization
- Certificate-based signatures — detached PKCS#7, ISO 32000-1 §12.8
- RFC 3161 trusted timestamps
- Bulk signing and sequential multi-party signing plans
- Security centre with embedded-JavaScript and color-space inspection
- Document audit trail

### Conversion and OCR

- Export to DOCX, XLSX, PPTX, EPUB and SVG
- OCR with projection-profile deskew and preprocessing
- Barcode and QR scanning

### Library

- Tags, collections, favorites, trash
- Smart folders and saved searches
- Query language: `tag:contract -tag:draft "signed copy"`
- Library-wide full-text search over an inverted index
- Watched folders for automatic import
- Version history
- Autosave with crash recovery

### Accessibility

- Keyboard navigation throughout
- Screen-reader tags panel
- Adjustable font scaling, reduced-motion mode
- Theme-aware contrast in light and dark

### Platform

- Windows (NSIS), macOS (DMG), Linux (AppImage)
- `@folio/engine` as a standalone, framework-agnostic package
- Plugin runtime for extending the command palette

[Unreleased]: https://github.com/naledisandamela/folio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/naledisandamela/folio/releases/tag/v0.1.0
