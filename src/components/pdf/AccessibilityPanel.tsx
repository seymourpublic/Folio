"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Heading, Table2, Image as ImageIcon, List, Link as LinkIcon, Tag } from "lucide-react";
import type { StructTreeNode } from "pdfjs-dist/types/src/display/api";
import {
  getDocumentTagStatus,
  getPageStructTree,
  isStructTreeNode,
  roleKind,
  roleLabel,
  structTreeHasContent,
  type TagNode,
  type PdfDocumentProxy,
  type DocPage,
} from "@folio/engine";
import { cn } from "@/lib/utils";

type AccessibilityPanelProps = {
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  currentPageId: string | null;
};

const ROLE_ICONS: Record<ReturnType<typeof roleKind>, typeof Tag> = {
  heading: Heading,
  table: Table2,
  figure: ImageIcon,
  list: List,
  link: LinkIcon,
  other: Tag,
};

export function AccessibilityPanel({ pages, pdfjsDocs, currentPageId }: AccessibilityPanelProps) {
  const pageIndex = Math.max(0, pages.findIndex((p) => p.id === currentPageId));
  const docPage = pages[pageIndex];
  const doc = docPage ? pdfjsDocs.get(docPage.sourceId) : undefined;

  const [markStatus, setMarkStatus] = useState<{ marked: boolean } | null>(null);
  const [tree, setTree] = useState<StructTreeNode | null | "loading">("loading");

  const [treePageKey, setTreePageKey] = useState(docPage?.id);
  if (docPage?.id !== treePageKey) {
    setTreePageKey(docPage?.id);
    if (tree !== "loading") setTree("loading");
  }

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    getDocumentTagStatus(doc).then((status) => {
      if (!cancelled) setMarkStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!doc || !docPage) return;
    let cancelled = false;
    getPageStructTree(doc, docPage.sourcePageIndex).then((result) => {
      if (!cancelled) setTree(result);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, docPage]);

  if (!docPage || !doc) {
    return <p className="text-muted-foreground p-3 text-sm">No page selected.</p>;
  }

  const hasContent = tree !== "loading" && structTreeHasContent(tree);

  return (
    <div className="flex flex-col gap-3 p-3">
      {markStatus && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium",
            markStatus.marked
              ? "border-success/30 bg-success-soft text-success"
              : "border-warning/30 bg-warning-soft text-warning"
          )}
        >
          {markStatus.marked ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {markStatus.marked ? "This PDF is marked as tagged" : "This PDF is not marked as tagged"}
        </div>
      )}

      <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Tags — page {pageIndex + 1}
      </div>

      {tree === "loading" && <p className="text-muted-foreground text-sm">Loading tag tree…</p>}

      {tree !== "loading" && !hasContent && (
        <p className="text-muted-foreground text-sm">
          No structure tags found on this page. Screen readers will fall back to raw reading
          order, which may not match the visual layout.
        </p>
      )}

      {tree !== "loading" && hasContent && tree && (
        <div className="flex flex-col gap-0.5">
          {tree.children.map((child, i) => (
            <TagTreeItem key={i} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function TagTreeItem({ node, depth }: { node: TagNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (!isStructTreeNode(node)) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-1.5 py-0.5 text-xs italic"
        style={{ paddingLeft: 6 + (depth + 1) * 14 }}
      >
        {node.type === "content" ? "content" : "object reference"}
      </div>
    );
  }

  const hasChildren = node.children.length > 0;
  const kind = roleKind(node.role);
  const Icon = ROLE_ICONS[kind];

  return (
    <div>
      <div
        className="hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm"
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
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
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            kind === "heading" && "text-brand",
            kind === "table" && "text-warning",
            kind === "figure" && "text-warning"
          )}
        />
        <span className="truncate">{roleLabel(node.role)}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child, i) => (
            <TagTreeItem key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
