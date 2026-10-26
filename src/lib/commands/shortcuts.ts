function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

const NAMED_KEYS: Record<string, string> = {
  esc: "escape",
  "+": "=",
};

function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  return NAMED_KEYS[lower] ?? lower;
}

/** Parses specs like "mod+k", "mod+shift+s", "arrowright", "escape". */
export function matchesShortcut(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.toLowerCase().split("+");
  const key = normalizeKey(parts[parts.length - 1]);
  const wantsMod = parts.includes("mod");
  const wantsShift = parts.includes("shift");
  const wantsAlt = parts.includes("alt");

  const hasMod = e.metaKey || e.ctrlKey;
  if (wantsMod !== hasMod) return false;
  if (wantsShift !== e.shiftKey) return false;
  if (wantsAlt !== e.altKey) return false;

  return normalizeKey(e.key) === key;
}

export function shortcutHasModifier(spec: string): boolean {
  return spec.toLowerCase().split("+").includes("mod");
}

export function isEditableEventTarget(target: EventTarget | null): boolean {
  return isEditableTarget(target);
}

/** Formats a shortcut spec for display, e.g. */
export function formatShortcut(spec: string): string {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? navigator.userAgent);
  const parts = spec.split("+");
  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "mod") return isMac ? "⌘" : "Ctrl";
      if (lower === "shift") return isMac ? "⇧" : "Shift";
      if (lower === "alt") return isMac ? "⌥" : "Alt";
      if (lower === "arrowleft") return "←";
      if (lower === "arrowright") return "→";
      if (lower === "arrowup") return "↑";
      if (lower === "arrowdown") return "↓";
      if (lower === "escape") return "Esc";
      return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");
}
