"use client";

import { useState } from "react";
import JSZip from "jszip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocPage, PdfDocumentProxy } from "@folio/engine";
import {
  extractAllPagesParagraphs,
  toPlainText,
  toMarkdown,
  toRtf,
  toHtml,
  exportAllPagesAsImages,
  toDocx,
  toPptx,
  toEpub,
  exportAsXlsx,
} from "@folio/engine/convert";
import { saveOrDownloadFile } from "@/lib/electron-bridge";

type ExportFormat = "pdf" | "txt" | "md" | "rtf" | "html" | "epub" | "docx" | "pptx" | "xlsx" | "png" | "jpg";

const FORMATS: { id: ExportFormat; label: string; sub: string }[] = [
  { id: "pdf", label: "PDF", sub: "With your edits" },
  { id: "docx", label: "Word", sub: ".docx — editable text" },
  { id: "pptx", label: "PowerPoint", sub: ".pptx — one slide per page" },
  { id: "xlsx", label: "Excel", sub: ".xlsx — detected tables" },
  { id: "html", label: "HTML", sub: "Single page, styled" },
  { id: "md", label: "Markdown", sub: ".md — plain structure" },
  { id: "epub", label: "EPUB", sub: "E-book, one chapter/page" },
  { id: "txt", label: "Plain text", sub: ".txt — no formatting" },
  { id: "rtf", label: "Rich Text", sub: ".rtf" },
  { id: "png", label: "Images (PNG)", sub: "Zipped if multi-page" },
  { id: "jpg", label: "Images (JPEG)", sub: "Zipped if multi-page" },
];

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onExportPdf: () => Promise<void>;
};

export function ExportDialog({ open, onOpenChange, fileName, pages, pdfjsDocs, onExportPdf }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const baseName = fileName.replace(/\.pdf$/i, "") || "document";

      if (format === "pdf") {
        await onExportPdf();
        onOpenChange(false);
        return;
      }

      if (format === "png" || format === "jpg") {
        const images = await exportAllPagesAsImages(pages, pdfjsDocs, format === "png" ? "png" : "jpeg");
        if (images.length <= 1) {
          const img = images[0];
          if (img) {
            await saveOrDownloadFile(img.bytes, `${baseName}.${format}`, format === "png" ? "image/png" : "image/jpeg", format);
          }
        } else {
          const zip = new JSZip();
          for (const img of images) zip.file(img.name, img.bytes);
          const zipBytes = await zip.generateAsync({ type: "uint8array" });
          await saveOrDownloadFile(zipBytes, `${baseName}-pages.zip`, "application/zip", "zip");
        }
        onOpenChange(false);
        return;
      }

      if (format === "xlsx") {
        const bytes = await exportAsXlsx(pages, pdfjsDocs, baseName);
        await saveOrDownloadFile(
          bytes,
          `${baseName}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "xlsx"
        );
        onOpenChange(false);
        return;
      }

      if (format === "pptx") {
        const bytes = await toPptx(pages, pdfjsDocs);
        await saveOrDownloadFile(
          bytes,
          `${baseName}.pptx`,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "pptx"
        );
        onOpenChange(false);
        return;
      }

      const paragraphs = await extractAllPagesParagraphs(pages, pdfjsDocs);
      switch (format) {
        case "txt":
          await saveOrDownloadFile(toPlainText(paragraphs), `${baseName}.txt`, "text/plain", "txt");
          break;
        case "md":
          await saveOrDownloadFile(toMarkdown(paragraphs, baseName), `${baseName}.md`, "text/markdown", "md");
          break;
        case "rtf":
          await saveOrDownloadFile(toRtf(paragraphs), `${baseName}.rtf`, "application/rtf", "rtf");
          break;
        case "html":
          await saveOrDownloadFile(toHtml(paragraphs, baseName), `${baseName}.html`, "text/html", "html");
          break;
        case "epub": {
          const bytes = await toEpub(paragraphs, baseName);
          await saveOrDownloadFile(bytes, `${baseName}.epub`, "application/epub+zip", "epub");
          break;
        }
        case "docx": {
          const bytes = await toDocx(paragraphs, baseName);
          await saveOrDownloadFile(
            bytes,
            `${baseName}.docx`,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "docx"
          );
          break;
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export document</DialogTitle>
          <DialogDescription>
            Word/PowerPoint/Excel/EPUB are generated from extracted page text and layout
            geometry, not a byte-for-byte layout clone — good for getting real, editable
            content out of a PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-md border p-2.5 text-left text-xs",
                format === f.id ? "border-primary bg-accent" : "border-border"
              )}
            >
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-muted-foreground">{f.sub}</div>
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isExporting} onClick={handleExport}>
            {isExporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
