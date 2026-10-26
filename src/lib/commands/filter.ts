import type { Command } from "./types";

/** Substring matches score higher (and earlier matches score higher still). */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;

  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;

  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      score++;
    }
  }
  return qi === q.length ? score : -1;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const trimmed = query.trim();
  if (!trimmed) return commands;

  return commands
    .map((cmd) => {
      const haystacks = [cmd.title, ...(cmd.keywords ?? [])];
      const score = Math.max(...haystacks.map((h) => fuzzyScore(trimmed, h)));
      return { cmd, score };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.cmd);
}
