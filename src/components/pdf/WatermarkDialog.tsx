"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { WatermarkOptions } from "@folio/engine";

type WatermarkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watermark: WatermarkOptions | null;
  onApply: (watermark: WatermarkOptions | null) => void;
};

function firstValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

const DEFAULTS: WatermarkOptions = {
  text: "CONFIDENTIAL",
  opacity: 0.25,
  fontSize: 64,
  rotationDeg: 45,
  color: "#ff0000",
};

export function WatermarkDialog({ open, onOpenChange, watermark, onApply }: WatermarkDialogProps) {
  const [draft, setDraft] = useState<WatermarkOptions>(watermark ?? DEFAULTS);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(watermark ?? DEFAULTS);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watermark</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Text</Label>
            <Input
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="CONFIDENTIAL"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Opacity ({Math.round(draft.opacity * 100)}%)</Label>
            <Slider
              value={[draft.opacity * 100]}
              min={5}
              max={100}
              step={5}
              onValueChange={(v) => setDraft({ ...draft, opacity: firstValue(v) / 100 })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Font size ({draft.fontSize}pt)</Label>
            <Slider
              value={[draft.fontSize]}
              min={12}
              max={120}
              step={2}
              onValueChange={(v) => setDraft({ ...draft, fontSize: firstValue(v) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rotation ({draft.rotationDeg}°)</Label>
            <Slider
              value={[draft.rotationDeg]}
              min={0}
              max={90}
              step={5}
              onValueChange={(v) => setDraft({ ...draft, rotationDeg: firstValue(v) })}
            />
          </div>

          <div className="flex items-center gap-3">
            <Label>Color</Label>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-8 w-12 rounded border"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {watermark && (
            <Button
              variant="ghost"
              onClick={() => {
                onApply(null);
                onOpenChange(false);
              }}
            >
              Remove watermark
            </Button>
          )}
          <Button
            disabled={!draft.text.trim()}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply to all pages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
