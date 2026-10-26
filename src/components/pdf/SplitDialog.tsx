"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SplitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numPages: number;
  onSplit: (mode: "everyN" | "atBreaks", value: number | number[]) => Promise<void>;
};

export function SplitDialog({ open, onOpenChange, numPages, onSplit }: SplitDialogProps) {
  const [everyN, setEveryN] = useState(1);
  const [breaksInput, setBreaksInput] = useState("");
  const [isSplitting, setIsSplitting] = useState(false);

  async function handleSplitEveryN() {
    setIsSplitting(true);
    try {
      await onSplit("everyN", everyN);
      onOpenChange(false);
    } finally {
      setIsSplitting(false);
    }
  }

  async function handleSplitAtBreaks() {
    const breaks = breaksInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n < numPages);
    setIsSplitting(true);
    try {
      await onSplit("atBreaks", breaks);
      onOpenChange(false);
    } finally {
      setIsSplitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split document</DialogTitle>
          <DialogDescription>
            This document has {numPages} page{numPages === 1 ? "" : "s"}. Output files download as a
            single .zip.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="everyN">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="everyN">Every N pages</TabsTrigger>
            <TabsTrigger value="breaks">At page breaks</TabsTrigger>
          </TabsList>

          <TabsContent value="everyN" className="space-y-3">
            <div className="space-y-1.5">
              <Label>Pages per file</Label>
              <Input
                type="number"
                min={1}
                max={numPages}
                value={everyN}
                onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <Button disabled={isSplitting} onClick={handleSplitEveryN}>
              {isSplitting ? "Splitting…" : `Split into ${Math.ceil(numPages / everyN)} files`}
            </Button>
          </TabsContent>

          <TabsContent value="breaks" className="space-y-3">
            <div className="space-y-1.5">
              <Label>Break after page numbers (comma-separated)</Label>
              <Input
                placeholder="e.g. 3, 7, 10"
                value={breaksInput}
                onChange={(e) => setBreaksInput(e.target.value)}
              />
            </div>
            <Button disabled={isSplitting || !breaksInput.trim()} onClick={handleSplitAtBreaks}>
              {isSplitting ? "Splitting…" : "Split"}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
