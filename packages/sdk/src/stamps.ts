import type { StampPresetId } from "./document-model";

export type StampPreset = { id: StampPresetId; label: string; color: string };

export const STAMP_PRESETS: StampPreset[] = [
  { id: "approved", label: "APPROVED", color: "#16a34a" },
  { id: "draft", label: "DRAFT", color: "#6b7280" },
  { id: "confidential", label: "CONFIDENTIAL", color: "#dc2626" },
  { id: "final", label: "FINAL", color: "#2563eb" },
  { id: "for-review", label: "FOR REVIEW", color: "#d97706" },
  { id: "void", label: "VOID", color: "#dc2626" },
  { id: "completed", label: "COMPLETED", color: "#16a34a" },
  { id: "urgent", label: "URGENT", color: "#dc2626" },
];

export function stampPreset(id: StampPresetId | undefined): StampPreset | undefined {
  return STAMP_PRESETS.find((p) => p.id === id);
}
