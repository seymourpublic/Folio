/**
 * Mirrors src/lib/commands/shortcut-manifest.ts in the application repository.
 * Keep the two in sync when a binding changes.
 */
export type ShortcutGroup = {
  title: string;
  items: { label: string; shortcut: string }[];
};

export const shortcutGroups: ShortcutGroup[] = [
  {
    title: "General",
    items: [
      { label: "Command palette", shortcut: "mod+k" },
      { label: "Search in document", shortcut: "mod+f" },
      { label: "Toggle sidebar", shortcut: "mod+b" },
      { label: "Download PDF", shortcut: "mod+s" },
    ],
  },
  {
    title: "Tabs",
    items: [
      { label: "Open new tab", shortcut: "mod+t" },
      { label: "Close tab", shortcut: "mod+w" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { label: "Previous page", shortcut: "arrowleft" },
      { label: "Next page", shortcut: "arrowright" },
      { label: "First page", shortcut: "home" },
      { label: "Last page", shortcut: "end" },
      { label: "Go back", shortcut: "alt+arrowleft" },
      { label: "Go forward", shortcut: "alt+arrowright" },
    ],
  },
  {
    title: "Zoom",
    items: [
      { label: "Zoom in", shortcut: "mod+=" },
      { label: "Zoom out", shortcut: "mod+-" },
      { label: "Zoom to fit width", shortcut: "mod+0" },
    ],
  },
];

const KEY_LABELS: Record<string, { mac: string; other: string }> = {
  mod: { mac: "⌘", other: "Ctrl" },
  alt: { mac: "⌥", other: "Alt" },
  shift: { mac: "⇧", other: "Shift" },
  arrowleft: { mac: "←", other: "←" },
  arrowright: { mac: "→", other: "→" },
  arrowup: { mac: "↑", other: "↑" },
  arrowdown: { mac: "↓", other: "↓" },
  home: { mac: "Home", other: "Home" },
  end: { mac: "End", other: "End" },
};

/** Turns a stored spec like `mod+k` into display keys for the given platform. */
export function formatShortcut(shortcut: string, platform: "mac" | "other"): string[] {
  return shortcut.split("+").map((part) => {
    const mapped = KEY_LABELS[part];
    if (mapped) return mapped[platform];
    return part.length === 1 ? part.toUpperCase() : part;
  });
}
