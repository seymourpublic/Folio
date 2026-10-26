"use client";

import { useEffect, useState } from "react";
import { Paperclip, Download } from "lucide-react";
import type { PdfDocumentProxy } from "@folio/engine";
import { Button } from "@/components/ui/button";

type AttachmentEntry = { id: string; filename: string; description: string };

type AttachmentsPanelProps = {
  doc: PdfDocumentProxy | undefined;
};

export function AttachmentsPanel({ doc }: AttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<AttachmentEntry[] | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc.getAttachments().then((map) => {
      if (cancelled) return;
      if (!map) {
        setAttachments([]);
        return;
      }
      setAttachments(
        Array.from(map.entries()).map(([id, att]) => ({
          id,
          filename: att.filename,
          description: att.description ?? "",
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  async function handleDownload(id: string, filename: string) {
    if (!doc) return;
    const content = await doc.getAttachmentContent(id);
    if (!content) return;
    const blob = new Blob([content as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!attachments) {
    return <p className="text-muted-foreground p-3 text-sm">Loading attachments…</p>;
  }

  if (attachments.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">This document has no attachments.</p>;
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {attachments.map((att) => (
        <div key={att.id} className="hover:bg-accent flex items-center gap-2 rounded-md p-2 text-sm">
          <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate">{att.filename}</p>
            {att.description && (
              <p className="text-muted-foreground truncate text-xs">{att.description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={`Download ${att.filename}`}
            onClick={() => handleDownload(att.id, att.filename)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
