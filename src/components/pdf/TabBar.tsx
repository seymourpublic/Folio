"use client";

import { Plus, X, Columns2, AppWindowMac } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsElectron } from "@/lib/electron-bridge";

export type TabInfo = { id: string; label: string };

type TabBarProps = {
  tabs: TabInfo[];
  activeTabId: string | null;
  splitTabId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRequestNewTab: () => void;
  onToggleSplit: () => void;
  canSplit: boolean;
};

export function TabBar({
  tabs,
  activeTabId,
  splitTabId,
  onActivate,
  onClose,
  onRequestNewTab,
  onToggleSplit,
  canSplit,
}: TabBarProps) {
  const isElectron = useIsElectron();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onActivate(tab.id)}
            className={cn(
              "group flex h-8 max-w-52 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm",
              tab.id === activeTabId
                ? "bg-brand-soft text-brand"
                : tab.id === splitTabId
                  ? "bg-muted/60"
                  : "hover:bg-muted/60"
            )}
          >
            <span className="truncate" title={tab.label}>
              {tab.label}
            </span>
            <span
              role="button"
              aria-label={`Close ${tab.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm opacity-0 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Open another PDF in a new tab"
              onClick={onRequestNewTab}
            />
          }
        >
          <Plus className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Open another PDF in a new tab</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={splitTabId ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Split view"
              disabled={!canSplit}
              onClick={onToggleSplit}
            />
          }
        >
          <Columns2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Split view (compare two documents side by side)</TooltipContent>
      </Tooltip>

      {isElectron && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="New window"
                onClick={() => window.electronAPI?.newWindow()}
              />
            }
          >
            <AppWindowMac className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>New window</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
