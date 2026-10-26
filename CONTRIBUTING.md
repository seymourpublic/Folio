# Contributing to Folio

Thanks for considering a contribution. This document covers how to get the project running, how the codebase is laid out, and what makes a change straightforward to review.

By contributing you agree that your work is licensed under [GPL-3.0](LICENSE), or [Apache-2.0](packages/sdk/LICENSE) for changes inside `packages/sdk`.

## Getting set up

You need **Node.js 20.9 or later**.

```bash
git clone https://github.com/naledisandamela/folio.git
cd folio
npm install
```

The install covers both the app and the `packages/*` workspaces.

```bash
npm run dev              # browser only — fastest loop for UI work
npm run electron:dev     # full desktop app with hot reload
npm run build            # production build
```

Anything touching native file dialogs, watched folders or TSA requests only works under `electron:dev`, because those paths go through the main process.

### Working on the engine

`packages/sdk` builds independently:

```bash
cd packages/sdk
npm run dev          # tsup in watch mode
npm run typecheck
npm run smoke        # node + browser smoke tests
npm test             # typecheck, build, then smoke
```

The app imports the engine as `@folio/engine`, resolved through the workspace, so `npm run dev` in the SDK plus `npm run dev` at the root gives you a live loop across both.

## How the code is organized

```
electron/         Main process and preload. Native dialogs, folder watching, TSA proxy.
src/app/          Next.js entry — layout, globals, the single page that mounts Workspace.
src/components/
  pdf/            Every screen, panel and dialog in the application.
  ui/             shadcn primitives. Prefer composing these over new base components.
src/hooks/        useEditorDocument (document state), theme, shortcuts, navigation history.
src/lib/
  commands/       Command definitions and the shortcut manifest.
  pdf/            Browser-side concerns: IndexedDB, library, indexing, autosave.
  plugins/        The plugin runtime.
packages/sdk/     @folio/engine. All PDF logic. No DOM, no Electron, no React.
```

The line that matters most: **PDF logic belongs in `packages/sdk`, not in components.** If you find yourself importing `pdf-lib` or `pdfjs-dist` into a component, the operation probably belongs in the engine with the component calling it. That separation is what keeps the engine usable on its own and the UI testable.

`src/lib/pdf/` is the exception, and only for things that genuinely need the browser: IndexedDB storage, the library index, autosave, folder watching.

## Conventions

**Comments.** Explain *why*, not *what*, and keep it short. A line that restates the code below it should be deleted. Comments citing a spec (`ISO 32000-1 §12.8`) or explaining a workaround for a library bug are the ones worth writing.

**Types.** No `any` in new code. The engine's public surface is fully typed; keep it that way, since consumers depend on the generated `.d.ts`.

**Commands and shortcuts.** Add new actions to the command definitions in `src/lib/commands/` rather than wiring key handlers directly. `src/lib/commands/shortcut-manifest.ts` is the single source of truth for bound keys, and the documentation reads from it.

**Styling.** Tailwind, with design tokens from `src/app/globals.css`. Use the semantic tokens (`bg-background`, `text-foreground-tertiary`, `border-subtle`) rather than raw palette colors, so both themes stay correct.

**Accessibility.** New interactive elements need keyboard access and an accessible name. Respect `reduce-motion`, which the theme layer already exposes.

## Before you open a pull request

```bash
npx tsc --noEmit                          # app typecheck
npm run build                             # production build
cd packages/sdk && npm test               # engine typecheck, build, smoke
```

All three should pass. Then:

- Keep the change focused. A PR that fixes one thing gets reviewed quickly; one that fixes a bug and also reformats four files does not.
- Describe what you changed and why. If it's a UI change, a before/after screenshot helps a lot.
- If you changed engine behavior, say whether it affects the public API.
- Reference the issue it closes.

## Reporting bugs

Open an issue using the bug template. The details that actually help:

- Your OS and Folio version
- Whether you're on a downloaded build or a source build
- A sample PDF, if one is involved and you can share it — most rendering and signing bugs are file-specific and very hard to reproduce without one
- What you expected versus what happened

If the PDF is confidential, please say so and describe its structure instead (encrypted? tagged? scanned? which producer generated it?).

## Suggesting features

Open an issue describing the problem before the solution. Folio deliberately does not aim for feature parity with Acrobat — the goal is the set of things people genuinely need, done well. A proposal that explains the workflow you're stuck on is more persuasive than one naming a feature.

## Security

Do not open a public issue for vulnerabilities. See [SECURITY.md](SECURITY.md).
