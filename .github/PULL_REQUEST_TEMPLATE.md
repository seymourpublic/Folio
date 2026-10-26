## What this changes

<!-- A sentence or two. If it fixes an issue, add "Closes #123". -->

## Why

<!-- The problem being solved. Skip if it's obvious from the issue. -->

## How to test it

<!-- The steps a reviewer should take. Note if a particular kind of document is needed. -->

## Screenshots

<!-- For UI changes, before and after. Delete this section otherwise. -->

## Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] `cd packages/sdk && npm test` passes (if the engine changed)
- [ ] New interactive elements are keyboard accessible and have accessible names
- [ ] PDF logic went into `packages/sdk`, not into components
- [ ] Comments explain *why*, and there are no comments restating the code
- [ ] New shortcuts are registered in `src/lib/commands/shortcut-manifest.ts`

## Engine API

<!-- If packages/sdk changed: is this additive, or does it break existing consumers? -->

- [ ] No change to the public API of `@folio/engine`
- [ ] Additive only
- [ ] Breaking — described above
