"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PdfDocumentProxy, DocPage } from "@folio/engine";
import { cn } from "@/lib/utils";

type OutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
};

type PageRef = Parameters<PdfDocumentProxy["getPageIndex"]>[0];

type OutlinePanelProps = {
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onNavigate: (pageId: string) => void;
};

export function OutlinePanel({ pages, pdfjsDocs, onNavigate }: OutlinePanelProps) {
  const primarySourceId = pages[0]?.sourceId;
  const doc = primarySourceId ? pdfjsDocs.get(primarySourceId) : undefined;
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc.getOutline().then((result) => {
      if (!cancelled) setOutline((result as OutlineNode[] | null) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  async function resolvePageId(dest: string | unknown[] | null): Promise<string | null> {
    if (!doc || !dest || !primarySourceId) return null;
    const explicitDest = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicitDest) || explicitDest.length === 0) return null;
    try {
      const pageIndex = await doc.getPageIndex(explicitDest[0] as PageRef);
      const target = pages.find((p) => p.sourceId === primarySourceId && p.sourcePageIndex === pageIndex);
      return target?.id ?? null;
    } catch {
      return null;
    }
  }

  if (!outline) {
    return <p className="text-muted-foreground p-3 text-sm">Loading outline…</p>;
  }

  if (outline.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">This document has no outline.</p>;
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {outline.map((node, i) => (
        <OutlineItem key={i} node={node} depth={0} onNavigate={onNavigate} resolvePageId={resolvePageId} />
      ))}
    </div>
  );
}

function OutlineItem({
  node,
  depth,
  onNavigate,
  resolvePageId,
}: {
  node: OutlineNode;
  depth: number;
  onNavigate: (pageId: string) => void;
  resolvePageId: (dest: string | unknown[] | null) => Promise<string | null>;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.items.length > 0;

  return (
    <div>
      <div
        className="hover:bg-accent flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-left text-sm"
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={async () => {
          const pageId = await resolvePageId(node.dest);
          if (pageId) onNavigate(pageId);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="text-muted-foreground shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className={cn("truncate", depth === 0 && "font-medium")}>{node.title || "Untitled"}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.items.map((child, i) => (
            <OutlineItem
              key={i}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              resolvePageId={resolvePageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
