import type { DocPage } from "./document-model";

export function groupPagesEveryN(pages: DocPage[], n: number): DocPage[][] {
  const groups: DocPage[][] = [];
  for (let i = 0; i < pages.length; i += n) groups.push(pages.slice(i, i + n));
  return groups;
}

export function groupPagesAtBreaks(pages: DocPage[], breakAfterPageNumbers: number[]): DocPage[][] {
  const breaks = new Set(breakAfterPageNumbers);
  const groups: DocPage[][] = [];
  let current: DocPage[] = [];
  pages.forEach((p, i) => {
    current.push(p);
    if (breaks.has(i + 1)) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length) groups.push(current);
  return groups.filter((g) => g.length > 0);
}
