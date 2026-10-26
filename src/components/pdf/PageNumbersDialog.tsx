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
import { Checkbox } from "@/components/ui/checkbox";
import type { PageNumberingOptions, PageNumberPosition } from "@folio/engine";

type PageNumbersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageNumbering: PageNumberingOptions | null;
  onApply: (options: PageNumberingOptions | null) => void;
};

const DEFAULTS: PageNumberingOptions = {
  enabled: true,
  position: "bottom-center",
  format: "{n}",
  startAt: 1,
  fontSize: 10,
  headerText: "",
  footerText: "",
};

const POSITIONS: PageNumberPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function PageNumbersDialog({
  open,
  onOpenChange,
  pageNumbering,
  onApply,
}: PageNumbersDialogProps) {
  const [draft, setDraft] = useState<PageNumberingOptions>(pageNumbering ?? DEFAULTS);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(pageNumbering ?? DEFAULTS);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Page numbers &amp; header/footer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="pn-enabled"
              checked={draft.enabled}
              onCheckedChange={(c) => setDraft({ ...draft, enabled: Boolean(c) })}
            />
            <Label htmlFor="pn-enabled" className="font-normal">
              Show page numbers
            </Label>
          </div>

          {draft.enabled && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div className="space-y-1.5">
                <Label>Position</Label>
                <select
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value as PageNumberPosition })}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Input
                  value={draft.format}
                  onChange={(e) => setDraft({ ...draft, format: e.target.value })}
                  placeholder="{n} of {total}"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Start at</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.startAt}
                  onChange={(e) => setDraft({ ...draft, startAt: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Font size</Label>
                <Input
                  type="number"
                  min={6}
                  max={24}
                  value={draft.fontSize}
                  onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) || 10 })}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5 border-t pt-3">
            <Label>Header text (optional)</Label>
            <Input
              value={draft.headerText}
              onChange={(e) => setDraft({ ...draft, headerText: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Footer text (optional)</Label>
            <Input
              value={draft.footerText}
              onChange={(e) => setDraft({ ...draft, footerText: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {pageNumbering && (
            <Button
              variant="ghost"
              onClick={() => {
                onApply(null);
                onOpenChange(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button
            onClick={() => {
              onApply(draft);
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
