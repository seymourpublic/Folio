"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImageAnnotation, ImageCrop } from "@folio/engine";

type ImageEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotation: ImageAnnotation | null;
  onApply: (patch: Partial<ImageAnnotation>) => void;
};

const PREVIEW_WIDTH = 420;

const MASK_OPTIONS: { id: NonNullable<ImageAnnotation["maskShape"]>; label: string }[] = [
  { id: "none", label: "None" },
  { id: "rounded", label: "Rounded" },
  { id: "ellipse", label: "Ellipse" },
];

export function ImageEditDialog({ open, onOpenChange, annotation, onApply }: ImageEditDialogProps) {
  const [draftCrop, setDraftCrop] = useState<ImageCrop | null>(annotation?.crop ?? null);
  const [draftMask, setDraftMask] = useState<ImageAnnotation["maskShape"]>(annotation?.maskShape ?? "none");
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);

  if (!annotation) return null;

  const previewHeight = PREVIEW_WIDTH * (naturalSize.height / naturalSize.width || 1);

  function toFraction(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const p = toFraction(e.clientX, e.clientY);
    dragRef.current = { x0: p.x, y0: p.y };
    setDraftCrop({ x: p.x, y: p.y, width: 0, height: 0 });
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const p = toFraction(e.clientX, e.clientY);
    const { x0, y0 } = dragRef.current;
    setDraftCrop({
      x: Math.min(x0, p.x),
      y: Math.min(y0, p.y),
      width: Math.abs(p.x - x0),
      height: Math.abs(p.y - y0),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
    setDraftCrop((c) => (c && c.width > 0.02 && c.height > 0.02 ? c : null));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop &amp; mask image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Drag on the image to select a crop area.</p>
          <div
            ref={containerRef}
            className="relative mx-auto touch-none overflow-hidden rounded border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:16px_16px] select-none"
            style={{ width: PREVIEW_WIDTH, height: previewHeight }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={annotation.dataUrl}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
              }}
            />
            {draftCrop && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                style={{
                  left: `${draftCrop.x * 100}%`,
                  top: `${draftCrop.y * 100}%`,
                  width: `${draftCrop.width * 100}%`,
                  height: `${draftCrop.height * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setDraftCrop(null)}>
              Reset crop
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground mr-1 text-xs">Mask:</span>
              {MASK_OPTIONS.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={draftMask === m.id ? "secondary" : "outline"}
                  className={cn("h-7 px-2 text-xs")}
                  onClick={() => setDraftMask(m.id)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply({ crop: draftCrop ?? undefined, maskShape: draftMask });
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
