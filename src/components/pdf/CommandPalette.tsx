"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Command, CommandCategory } from "@/lib/commands/types";
import { filterCommands } from "@/lib/commands/filter";
import { formatShortcut } from "@/lib/commands/shortcuts";

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  "search-hit": "In document",
  file: "File",
  navigation: "Navigation",
  view: "View",
  panel: "Panels",
  tool: "Tools",
  annotate: "Annotate",
  document: "Document",
  plugin: "Plugins",
};

const CATEGORY_ORDER: CommandCategory[] = [
  "search-hit",
  "navigation",
  "view",
  "panel",
  "tool",
  "annotate",
  "document",
  "plugin",
  "file",
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  /** Called (debounced by the caller) as the query changes; hits feed back via `searchHits`. */
  onQueryChange?: (query: string) => void;
  /** Pre-filtered search-hit commands (category "search-hit") for the current query. */
  searchHits?: Command[];
};

export function CommandPalette({ open, onOpenChange, commands, onQueryChange, searchHits }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  const grouped = useMemo(() => {
    const filtered = filterCommands(commands, query);
    const all = query.trim() ? [...(searchHits ?? []), ...filtered] : filtered;
    const byCategory = new Map<CommandCategory, Command[]>();
    for (const cmd of all) {
      const list = byCategory.get(cmd.category) ?? [];
      list.push(cmd);
      byCategory.set(cmd.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      items: byCategory.get(category)!,
    }));
    // searchHits is already relevance-filtered by the caller for the current query
  }, [commands, query, searchHits]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function runActive() {
    const cmd = flat[activeIndex];
    if (!cmd || cmd.disabled) return;
    onOpenChange(false);
    cmd.run();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  }

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-lg -translate-y-0 gap-0 overflow-hidden p-0"
      >
        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search commands, content, comments…"
          className="h-12 rounded-none border-0 border-b px-4 text-sm shadow-none focus-visible:ring-0"
        />
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {flat.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">No matching commands</p>
          )}
          {grouped.map(({ category, items }) => (
            <div key={category} className="mb-1 last:mb-0">
              <div className="text-muted-foreground px-2.5 py-1 text-xs font-medium">
                {CATEGORY_LABELS[category]}
              </div>
              {items.map((cmd) => {
                runningIndex++;
                const index = runningIndex;
                return (
                  <button
                    key={cmd.id}
                    data-index={index}
                    disabled={cmd.disabled}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (cmd.disabled) return;
                      onOpenChange(false);
                      cmd.run();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40",
                      index === activeIndex ? "bg-accent text-accent-foreground" : ""
                    )}
                  >
                    <span className="truncate">{cmd.title}</span>
                    {cmd.shortcut && (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {cmd.shortcutLabel ?? formatShortcut(cmd.shortcut)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
