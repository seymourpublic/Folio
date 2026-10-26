const RECENT_MENTIONS_KEY = "acrobat-clone:recent-mentions";
const MAX_RECENT_MENTIONS = 12;

/** Names used in previous @mentions, most-recent-first. */
export function getRecentMentionNames(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_MENTIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function recordMentionNames(names: string[]): void {
  if (names.length === 0) return;
  try {
    const existing = getRecentMentionNames().filter((n) => !names.includes(n));
    window.localStorage.setItem(RECENT_MENTIONS_KEY, JSON.stringify([...names, ...existing].slice(0, MAX_RECENT_MENTIONS)));
  } catch {
    // Best-effort — autocomplete history just won't persist if storage is unavailable.
  }
}
