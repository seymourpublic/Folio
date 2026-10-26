"use client";

import { PanelLeft, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TabBar, type TabInfo } from "./TabBar";
import { useTheme } from "@/hooks/useTheme";
import { formatShortcut } from "@/lib/commands/shortcuts";

type AppTopbarProps = {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  tabs: TabInfo[];
  activeTabId: string | null;
  splitTabId: string | null;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onRequestNewTab: () => void;
  onToggleSplit: () => void;
  canSplit: boolean;
  onOpenPalette: () => void;
};

/** The small hand-drawn document mark from the Folio reference. */
function FolioMark({ size = 26 }: { size?: number }) {
  const glyphW = Math.round(size * 0.42);
  const glyphH = Math.round(size * 0.5);
  return (
    <div
      className="bg-brand flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size }}
    >
      <div
        className="border-brand-foreground relative rounded-[3px] border-[1.6px]"
        style={{ width: glyphW, height: glyphH }}
      >
        <div className="bg-brand-foreground absolute top-[22%] right-[18%] left-[18%] h-[10%] rounded-full" />
        <div className="bg-brand-foreground absolute top-[45%] right-[28%] left-[18%] h-[10%] rounded-full" />
      </div>
    </div>
  );
}

export function AppTopbar({
  isSidebarCollapsed,
  onToggleSidebar,
  tabs,
  activeTabId,
  splitTabId,
  onActivateTab,
  onCloseTab,
  onRequestNewTab,
  onToggleSplit,
  canSplit,
  onOpenPalette,
}: AppTopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="bg-card border-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
        <PanelLeft className={isSidebarCollapsed ? "text-muted-foreground h-4 w-4" : "text-brand h-4 w-4"} />
      </Button>

      <FolioMark />
      <span className="mr-1 text-sm font-semibold tracking-tight">Folio</span>

      <Separator orientation="vertical" className="mx-1 h-5.5" />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        splitTabId={splitTabId}
        onActivate={onActivateTab}
        onClose={onCloseTab}
        onRequestNewTab={onRequestNewTab}
        onToggleSplit={onToggleSplit}
        canSplit={canSplit}
      />

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        className="text-muted-foreground border-border bg-background hover:text-foreground flex h-8 items-center gap-2 rounded-lg border px-3 text-xs"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search or run a command</span>
        <span className="bg-muted text-foreground-tertiary ml-1.5 rounded px-1.5 py-0.5 font-mono text-[11px]">
          {formatShortcut("mod+k")}
        </span>
      </button>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}>
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>
    </div>
  );
}
