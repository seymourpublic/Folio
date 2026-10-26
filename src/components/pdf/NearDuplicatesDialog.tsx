"use client";

import { useEffect, useState } from "react";
import { Copy as CopyIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { findNearDuplicates, type NearDuplicatePair } from "@/lib/pdf/near-duplicates";

type NearDuplicatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NearDuplicatesDialog({ open, onOpenChange }: NearDuplicatesDialogProps) {
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [pairs, setPairs] = useState<NearDuplicatePair[]>([]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStatus("idle");
      setPairs([]);
    }
  }

  useEffect(() => {
    if (!open || status !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("scanning");
    findNearDuplicates().then((result) => {
      setPairs(result);
      setStatus("done");
    });
  }, [open, status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Near-duplicate documents</DialogTitle>
          <DialogDescription>
            Compares SimHash fingerprints of each indexed document&apos;s text — flags pairs that
            are very similar (a few edits apart), not just byte-identical files.
          </DialogDescription>
        </DialogHeader>

        {status === "scanning" && <p className="text-muted-foreground text-sm">Scanning library…</p>}

        {status === "done" && pairs.length === 0 && (
          <p className="text-muted-foreground text-sm">No near-duplicates found.</p>
        )}

        {status === "done" && pairs.length > 0 && (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {pairs.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5 text-xs">
                <CopyIcon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nameA}</p>
                  <p className="truncate font-medium">{p.nameB}</p>
                  <p className="text-muted-foreground mt-1">
                    {p.distance === 0 ? "Identical text content" : `${p.distance} bits different (out of 64)`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
