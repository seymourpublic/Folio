"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AutosaveSummary } from "@/lib/pdf/autosave";
import { formatRelativeTime } from "@/lib/format";

type CrashRecoveryDialogProps = {
  entries: AutosaveSummary[];
  onRestore: (entry: AutosaveSummary) => void;
  onDiscard: (entry: AutosaveSummary) => void;
  onDiscardAll: () => void;
};

export function CrashRecoveryDialog({ entries, onRestore, onDiscard, onDiscardAll }: CrashRecoveryDialogProps) {
  return (
    <Dialog open={entries.length > 0} onOpenChange={(open) => !open && onDiscardAll()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restore unsaved work?</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {entries.length === 1
            ? "A document with unsaved changes was found from a previous session."
            : `${entries.length} documents with unsaved changes were found from a previous session.`}
        </p>
        <div className="flex flex-col gap-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{entry.fileName || "Untitled"}</div>
                <div className="text-muted-foreground text-xs">{formatRelativeTime(entry.timestamp)}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => onDiscard(entry)}>
                  Discard
                </Button>
                <Button size="sm" onClick={() => onRestore(entry)}>
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onDiscardAll}>
            Dismiss all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
