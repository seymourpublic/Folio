"use client";

import { useRef, useState } from "react";
import {
  RotateCcw,
  RotateCw,
  Copy,
  Trash2,
  FilePlus2,
  Scissors,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DocPage, PdfDocumentProxy } from "@folio/engine";
import { PdfThumbnail } from "./PdfThumbnail";

type OrganizePagesViewProps = {
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRotate: (pageId: string, delta: number) => void;
  onDelete: (pageId: string) => void;
  onDuplicate: (pageId: string) => void;
  onAddFile: (file: File) => void;
  onExtract: (pageIds: string[]) => void;
  onClose: () => void;
};

export function OrganizePagesView({
  pages,
  pdfjsDocs,
  onReorder,
  onRotate,
  onDelete,
  onDuplicate,
  onAddFile,
  onExtract,
  onClose,
}: OrganizePagesViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">Organize pages</span>
        <span className="text-muted-foreground text-xs">
          Drag to reorder · {selected.size} selected
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <FilePlus2 className="h-4 w-4" />
          Add pages from file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddFile(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onExtract(Array.from(selected))}
          className="gap-1.5"
        >
          <Scissors className="h-4 w-4" />
          Extract selected
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close organize view" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 p-4">
          {pages.map((docPage, index) => {
            const doc = pdfjsDocs.get(docPage.sourceId);
            if (!doc) return null;
            return (
              <div
                key={docPage.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn(
                  "bg-card relative flex flex-col items-center gap-2 rounded-lg border p-2",
                  dragIndex === index && "opacity-50"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
                  <Checkbox
                    checked={selected.has(docPage.id)}
                    onCheckedChange={() => toggleSelected(docPage.id)}
                  />
                </div>

                <PdfThumbnail
                  doc={doc}
                  sourcePageIndex={docPage.sourcePageIndex}
                  rotation={docPage.rotation}
                  label={index + 1}
                  isActive={false}
                  onClick={() => toggleSelected(docPage.id)}
                />

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Rotate left"
                    onClick={() => onRotate(docPage.id, -90)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Rotate right"
                    onClick={() => onRotate(docPage.id, 90)}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Duplicate page"
                    onClick={() => onDuplicate(docPage.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Delete page"
                    onClick={() => onDelete(docPage.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
