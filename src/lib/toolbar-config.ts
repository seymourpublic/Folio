export type ToolbarItemId =
  | "markup"
  | "shapes"
  | "forms"
  | "ink"
  | "text"
  | "edit-text"
  | "note"
  | "link"
  | "measurement"
  | "whiteout"
  | "redact"
  | "image"
  | "stamp"
  | "sign";

export const TOOLBAR_ITEM_LABELS: Record<ToolbarItemId, string> = {
  markup: "Markup tools",
  shapes: "Shape tools",
  forms: "Form field tools",
  ink: "Draw",
  text: "Add text",
  "edit-text": "Edit existing text",
  note: "Add sticky note",
  link: "Add link",
  measurement: "Measure distance",
  whiteout: "Whiteout",
  redact: "Redact",
  image: "Add image",
  stamp: "Stamp",
  sign: "Sign",
};

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  "markup",
  "shapes",
  "forms",
  "ink",
  "text",
  "edit-text",
  "note",
  "link",
  "measurement",
  "whiteout",
  "redact",
  "image",
  "stamp",
  "sign",
];

export type ToolbarLayout = { order: ToolbarItemId[]; hidden: ToolbarItemId[] };

const STORAGE_KEY = "acrobat-clone:toolbar-layout";

function isToolbarItemId(id: string): id is ToolbarItemId {
  return (DEFAULT_TOOLBAR_ORDER as string[]).includes(id);
}

export function loadToolbarLayout(): ToolbarLayout {
  if (typeof window === "undefined") return { order: DEFAULT_TOOLBAR_ORDER, hidden: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: DEFAULT_TOOLBAR_ORDER, hidden: [] };
    const parsed = JSON.parse(raw) as Partial<ToolbarLayout>;
    const order = (parsed.order ?? []).filter(isToolbarItemId);
    for (const id of DEFAULT_TOOLBAR_ORDER) if (!order.includes(id)) order.push(id);
    const hidden = (parsed.hidden ?? []).filter(isToolbarItemId);
    return { order, hidden };
  } catch {
    return { order: DEFAULT_TOOLBAR_ORDER, hidden: [] };
  }
}

export function saveToolbarLayout(layout: ToolbarLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
  }
}
