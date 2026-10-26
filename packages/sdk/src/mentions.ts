const MENTION_REGEX = /@([A-Za-z0-9_][A-Za-z0-9_.-]*)/g;

export function parseMentions(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(MENTION_REGEX)) names.add(m[1]);
  return Array.from(names);
}

export type MentionSegment = { type: "text" | "mention"; value: string };

/** Splits reply text into plain-text and @mention segments for rendering. */
export function renderMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(MENTION_REGEX)) {
    const index = m.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", value: text.slice(lastIndex, index) });
    segments.push({ type: "mention", value: m[0] });
    lastIndex = index + m[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: "text", value: text.slice(lastIndex) });
  return segments;
}
