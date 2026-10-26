"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ScanBarcode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DocPage, PdfDocumentProxy } from "@folio/engine";
import { scanDocumentForBarcodes, isBarcodeDetectionSupported, type PageBarcodeResult } from "@folio/engine/ocr";

type BarcodeScanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onNavigate: (pageId: string) => void;
};

export function BarcodeScanDialog({ open, onOpenChange, pages, pdfjsDocs, onNavigate }: BarcodeScanDialogProps) {
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<PageBarcodeResult[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const supported = isBarcodeDetectionSupported();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStatus("idle");
      setResults([]);
      setProgress({ done: 0, total: 0 });
    }
  }

  useEffect(() => {
    if (!open || status !== "idle" || !supported) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("scanning");
    scanDocumentForBarcodes(pages, pdfjsDocs, (done, total) => {
      if (!cancelled) setProgress({ done, total });
    }).then((r) => {
      if (!cancelled) {
        setResults(r);
        setStatus("done");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, status, supported, pages, pdfjsDocs]);

  function copy(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Barcodes &amp; QR codes</DialogTitle>
          <DialogDescription>Scans every page for barcodes using the browser&apos;s built-in detector.</DialogDescription>
        </DialogHeader>

        {!supported && (
          <p className="text-muted-foreground text-sm">
            Barcode detection isn&apos;t available in this build (needs Chromium&apos;s Shape
            Detection API).
          </p>
        )}

        {supported && status === "scanning" && (
          <p className="text-muted-foreground text-sm">
            Scanning page {progress.done} of {progress.total}…
          </p>
        )}

        {supported && status === "done" && results.length === 0 && (
          <p className="text-muted-foreground text-sm">No barcodes or QR codes found.</p>
        )}

        {supported && status === "done" && results.length > 0 && (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {results.map((r) => (
              <div key={r.pageIndex} className="rounded-lg border p-2.5">
                <button
                  onClick={() => onNavigate(pages[r.pageIndex].id)}
                  className="text-brand mb-1.5 text-xs font-semibold hover:underline"
                >
                  Page {r.pageIndex + 1}
                </button>
                <div className="flex flex-col gap-1.5">
                  {r.codes.map((c, i) => {
                    const key = `${r.pageIndex}-${i}`;
                    return (
                      <div key={key} className="bg-muted/50 flex items-center gap-2 rounded p-1.5 text-xs">
                        <ScanBarcode className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="text-muted-foreground shrink-0 uppercase">{c.format}</span>
                        <span className="min-w-0 flex-1 truncate font-mono">{c.rawValue}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copy(key, c.rawValue)}
                          aria-label="Copy value"
                        >
                          {copiedKey === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
