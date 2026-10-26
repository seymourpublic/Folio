"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown } from "lucide-react";
import { createId, type BookmarkNode, type DocPage } from "@folio/engine";

type FlatNode = { id: string; title: string; pageId: string; depth: number };

function flatten(nodes: BookmarkNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((n) => [
    { id: n.id, title: n.title, pageId: n.pageId, depth },
    ...flatten(n.children, depth + 1),
  ]);
}

function unflatten(flat: FlatNode[]): BookmarkNode[] {
  const root: BookmarkNode[] = [];
  const stack: BookmarkNode[] = [];
  for (const f of flat) {
    const node: BookmarkNode = { id: f.id, title: f.title, pageId: f.pageId, children: [] };
    if (f.depth === 0 || !stack[f.depth - 1]) {
      root.push(node);
    } else {
      stack[f.depth - 1].children.push(node);
    }
    stack[f.depth] = node;
    stack.length = f.depth + 1;
  }
  return root;
}

function subtreeEnd(flat: FlatNode[], index: number): number {
  const depth = flat[index].depth;
  let end = index + 1;
  while (end < flat.length && flat[end].depth > depth) end++;
  return end;
}

type BookmarksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: BookmarkNode[];
  onApply: (bookmarks: BookmarkNode[]) => void;
  pages: DocPage[];
  currentPageId: string | null;
};

export function BookmarksDialog({
  open,
  onOpenChange,
  bookmarks,
  onApply,
  pages,
  currentPageId,
}: BookmarksDialogProps) {
  const [flat, setFlat] = useState<FlatNode[]>(() => flatten(bookmarks));

  const pageLabelById = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [pages]);

  function resetOnOpen(next: boolean) {
    if (next) setFlat(flatten(bookmarks));
    onOpenChange(next);
  }

  function addBookmark() {
    const targetPageId = currentPageId ?? pages[0]?.id;
    if (!targetPageId) return;
    setFlat((prev) => [
      ...prev,
      { id: createId(), title: `Page ${pageLabelById.get(targetPageId) ?? 1}`, pageId: targetPageId, depth: 0 },
    ]);
  }

  function removeNode(index: number) {
    const end = subtreeEnd(flat, index);
    setFlat((prev) => [...prev.slice(0, index), ...prev.slice(end)]);
  }

  function renameNode(index: number, title: string) {
    setFlat((prev) => prev.map((n, i) => (i === index ? { ...n, title } : n)));
  }

  function setPage(index: number, pageId: string) {
    setFlat((prev) => prev.map((n, i) => (i === index ? { ...n, pageId } : n)));
  }

  function indent(index: number) {
    if (index === 0 || flat[index - 1].depth < flat[index].depth) return;
    if (flat[index - 1].depth > flat[index].depth) return;
    const end = subtreeEnd(flat, index);
    setFlat((prev) => prev.map((n, i) => (i >= index && i < end ? { ...n, depth: n.depth + 1 } : n)));
  }

  function outdent(index: number) {
    if (flat[index].depth === 0) return;
    const end = subtreeEnd(flat, index);
    setFlat((prev) => prev.map((n, i) => (i >= index && i < end ? { ...n, depth: n.depth - 1 } : n)));
  }

  function moveUp(index: number) {
    const depth = flat[index].depth;
    let prevStart = index - 1;
    while (prevStart >= 0 && flat[prevStart].depth > depth) prevStart--;
    if (prevStart < 0 || flat[prevStart].depth !== depth) return;
    const end = subtreeEnd(flat, index);
    const block = flat.slice(index, end);
    const prevBlock = flat.slice(prevStart, index);
    setFlat((prev) => [...prev.slice(0, prevStart), ...block, ...prevBlock, ...prev.slice(end)]);
  }

  function moveDown(index: number) {
    const depth = flat[index].depth;
    const end = subtreeEnd(flat, index);
    if (end >= flat.length || flat[end].depth !== depth) return;
    const nextEnd = subtreeEnd(flat, end);
    const block = flat.slice(index, end);
    const nextBlock = flat.slice(end, nextEnd);
    setFlat((prev) => [...prev.slice(0, index), ...nextBlock, ...block, ...prev.slice(nextEnd)]);
  }

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bookmarks</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-80">
          <div className="flex flex-col gap-1 pr-2">
            {flat.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">No bookmarks yet.</p>
            )}
            {flat.map((node, index) => (
              <div
                key={node.id}
                className="flex items-center gap-1"
                style={{ paddingLeft: node.depth * 20 }}
              >
                <Input
                  value={node.title}
                  onChange={(e) => renameNode(index, e.target.value)}
                  className="h-8 flex-1"
                />
                <select
                  value={node.pageId}
                  onChange={(e) => setPage(index, e.target.value)}
                  className="border-input h-8 rounded-md border bg-transparent px-1 text-xs"
                >
                  {pages.map((p, i) => (
                    <option key={p.id} value={p.id}>
                      Pg {i + 1}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => outdent(index)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => indent(index)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(index)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(index)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeNode(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button variant="ghost" size="sm" onClick={addBookmark} className="w-fit gap-1.5">
          <Plus className="h-4 w-4" />
          Add bookmark for current page
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(unflatten(flat));
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
