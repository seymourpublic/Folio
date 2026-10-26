"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PdfDocumentProxy } from "@folio/engine";

type PropertiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  pageCount: number;
  fileSizeBytes: number;
  doc: PdfDocumentProxy | undefined;
};

type InfoDict = Record<string, string | boolean | undefined>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right">{value || "—"}</span>
    </div>
  );
}

export function PropertiesDialog({
  open,
  onOpenChange,
  fileName,
  pageCount,
  fileSizeBytes,
  doc,
}: PropertiesDialogProps) {
  const [info, setInfo] = useState<InfoDict | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!open || !doc) return;
    let cancelled = false;
    doc.getMetadata().then(({ info }) => {
      if (!cancelled) setInfo(info as InfoDict);
    });
    doc.getPage(1).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      setPageSize({ width: Math.round(viewport.width), height: Math.round(viewport.height) });
    });
    return () => {
      cancelled = true;
    };
  }, [open, doc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Properties</DialogTitle>
        </DialogHeader>
        <div className="space-y-0.5">
          <Row label="File name" value={fileName} />
          <Row label="File size" value={formatBytes(fileSizeBytes)} />
          <Row label="Pages" value={String(pageCount)} />
          <Row
            label="Page size"
            value={pageSize ? `${pageSize.width} × ${pageSize.height} pt` : "—"}
          />
          <Row label="PDF version" value={info?.PDFFormatVersion ? String(info.PDFFormatVersion) : "—"} />
          <Row label="Producer" value={String(info?.Producer ?? "")} />
          <Row label="Creator" value={String(info?.Creator ?? "")} />
          <Row label="Created" value={String(info?.CreationDate ?? "")} />
          <Row label="Modified" value={String(info?.ModDate ?? "")} />
          <Row label="Contains forms" value={info?.IsAcroFormPresent ? "Yes" : "No"} />
          <Row label="Digitally signed" value={info?.IsSignaturesPresent ? "Yes" : "No"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
