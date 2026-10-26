"use client";

import { Eye, Highlighter, LayoutGrid, CheckSquare, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocMode = "view" | "annotate" | "organize" | "forms" | "compare";

const MODES: { id: DocMode; label: string; icon: typeof Eye }[] = [
  { id: "view", label: "View", icon: Eye },
  { id: "annotate", label: "Annotate", icon: Highlighter },
  { id: "organize", label: "Organize", icon: LayoutGrid },
  { id: "forms", label: "Forms", icon: CheckSquare },
  { id: "compare", label: "Compare", icon: GitCompare },
];

type ModeTabsProps = {
  mode: DocMode;
  onModeChange: (mode: DocMode) => void;
};

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex items-center gap-1">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
            mode === id ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
