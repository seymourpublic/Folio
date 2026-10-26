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
import type { DocumentMetadata } from "@folio/engine";

type MetadataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DocumentMetadata;
  onApply: (metadata: DocumentMetadata) => void;
};

export function MetadataDialog({ open, onOpenChange, metadata, onApply }: MetadataDialogProps) {
  const [draft, setDraft] = useState<DocumentMetadata>(metadata);
  const [keywordsInput, setKeywordsInput] = useState(metadata.keywords.join(", "));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(metadata);
          setKeywordsInput(metadata.keywords.join(", "));
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Document properties</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Author</Label>
            <Input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Keywords (comma-separated)</Label>
            <Input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply({
                ...draft,
                keywords: keywordsInput
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              });
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
