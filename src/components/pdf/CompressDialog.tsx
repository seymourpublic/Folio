"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompressOptions } from "@folio/engine";

type CompressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompress: (options: CompressOptions) => Promise<void>;
};

const PRESETS: { id: string; label: string; description: string; options: CompressOptions }[] = [
  { id: "low", label: "Smallest file", description: "Low quality — best for archiving/email limits", options: { scale: 1.2, quality: 0.55 } },
  { id: "medium", label: "Balanced", description: "Good quality, meaningfully smaller", options: { scale: 1.6, quality: 0.72 } },
  { id: "high", label: "High quality", description: "Larger file, sharper text and images", options: { scale: 2.2, quality: 0.85 } },
];

export function CompressDialog({ open, onOpenChange, onCompress }: CompressDialogProps) {
  const [presetId, setPresetId] = useState("medium");
  const [isCompressing, setIsCompressing] = useState(false);

  async function handleCompress() {
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1];
    setIsCompressing(true);
    try {
      await onCompress(preset.options);
      onOpenChange(false);
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compress document</DialogTitle>
          <DialogDescription>
            Flattens every page to a compressed image. Reduces file size significantly for image-heavy or
            scanned PDFs, but text will no longer be selectable or searchable in the output.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              className={cn(
                "w-full rounded-md border p-3 text-left text-sm",
                presetId === p.id ? "border-primary bg-accent" : "border-border"
              )}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-muted-foreground text-xs">{p.description}</div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isCompressing} onClick={handleCompress}>
            {isCompressing ? "Compressing…" : "Compress & download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
