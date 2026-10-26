export type CommandCategory =
  | "file"
  | "navigation"
  | "view"
  | "panel"
  | "tool"
  | "annotate"
  | "document"
  | "plugin"
  | "search-hit";

export type Command = {
  id: string;
  title: string;
  category: CommandCategory;
  /** Extra terms the palette's fuzzy filter should match against, beyond `title`. */
  keywords?: string[];
  /** Human-readable shortcut label shown in the palette, e.g. */
  shortcutLabel?: string;
  /** Shortcut spec string like "mod+k", "mod+shift+s", "arrowright", "escape". */
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
};
