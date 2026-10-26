"use client";

import { useMemo, useRef, useState } from "react";
import { X, Upload, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadPdfDocument,
  diffWords,
  countChanges,
  getPageTextForCompare,
  renderVisualDiff,
  MAX_DIFF_WORDS,
  type PdfDocumentProxy,
  type DocPage,
  type WordDiffToken,
} from "@folio/engine";

type ComparePagesViewProps = {
  fileName: string;
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onClose: () => void;
};

type PagePairDiff = {
  pageIndex: number;
  textA: string;
  textB: string;
  tokens: WordDiffToken[] | null; // null when too large to diff word-by-word
  changeCount: number;
  identical: boolean;
};

export function ComparePagesView({ fileName, pages, pdfjsDocs, onClose }: ComparePagesViewProps) {
  const [otherDoc, setOtherDoc] = useState<PdfDocumentProxy | null>(null);
  const [otherName, setOtherName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<PagePairDiff[] | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [visualDiffs, setVisualDiffs] = useState<Map<number, { url: string; diffPixels: number; totalPixels: number }>>(
    new Map()
  );
  const [visualLoading, setVisualLoading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const primarySourceId = pages[0]?.sourceId;
  const primaryDoc = primarySourceId ? pdfjsDocs.get(primarySourceId) : undefined;

  const summary = useMemo(() => {
    if (!diffs) return null;
    const differing = diffs.filter((d) => !d.identical).length;
    return { differing, total: diffs.length };
  }, [diffs]);

  async function handlePickFile(file: File) {
    setIsLoading(true);
    setLoadError(null);
    setDiffs(null);
    setVisualDiffs(new Map());
    setExpandedPage(null);
    try {
      const buf = await file.arrayBuffer();
      const doc = await loadPdfDocument(buf);
      setOtherDoc(doc);
      setOtherName(file.name);

      if (!primaryDoc) return;
      const pageCount = Math.max(pages.length, doc.numPages);
      const results: PagePairDiff[] = [];
      for (let i = 0; i < pageCount; i++) {
        const textA = i < pages.length ? await getPageTextForCompare(primaryDoc, pages[i].sourcePageIndex) : "";
        const textB = i < doc.numPages ? await getPageTextForCompare(doc, i) : "";
        const identical = textA === textB;
        const wordCount = textA.split(/\s+/).length + textB.split(/\s+/).length;
        const tokens = identical || wordCount > MAX_DIFF_WORDS ? null : diffWords(textA, textB);
        results.push({
          pageIndex: i,
          textA,
          textB,
          tokens,
          changeCount: tokens ? countChanges(tokens) : identical ? 0 : 1,
          identical,
        });
      }
      setDiffs(results);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't read that file as a PDF.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleShowVisualDiff(pageIndex: number) {
    if (!primaryDoc || !otherDoc || visualDiffs.has(pageIndex)) {
      setExpandedPage(pageIndex);
      return;
    }
    setVisualLoading(pageIndex);
    setExpandedPage(pageIndex);
    try {
      const sourcePageA = pages[pageIndex]?.sourcePageIndex ?? pageIndex;
      const result = await renderVisualDiff(primaryDoc, sourcePageA, otherDoc, pageIndex);
      const url = result.canvas.toDataURL("image/png");
      setVisualDiffs((prev) => new Map(prev).set(pageIndex, { url, diffPixels: result.diffPixels, totalPixels: result.totalPixels }));
    } finally {
      setVisualLoading(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="text-sm font-medium">
          {otherDoc ? (
            <>
              Comparing <span className="font-semibold">{fileName}</span> ↔{" "}
              <span className="font-semibold">{otherName}</span>
              {summary && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {summary.differing === 0
                    ? "— identical"
                    : `— ${summary.differing} of ${summary.total} page${summary.total === 1 ? "" : "s"} differ`}
                </span>
              )}
            </>
          ) : (
            "Compare documents"
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close compare mode">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!otherDoc && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted text-foreground-tertiary flex h-14 w-14 items-center justify-center rounded-2xl">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-sm font-semibold">Choose a PDF to compare against &quot;{fileName}&quot;</div>
            <p className="text-muted-foreground text-xs">
              Pages are matched by position (page 1 vs page 1, etc). Text differences are shown
              inline; a per-page visual diff highlights pixel-level layout/image changes too.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePickFile(file);
                e.target.value = "";
              }}
            />
            <Button disabled={isLoading} onClick={() => fileInputRef.current?.click()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Choose file…
            </Button>
            {loadError && <p className="text-destructive text-xs">{loadError}</p>}
          </div>
        )}

        {otherDoc && diffs && (
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {diffs.map((d) => (
              <div key={d.pageIndex} className="border-border overflow-hidden rounded-xl border">
                <button
                  onClick={() => setExpandedPage((p) => (p === d.pageIndex ? null : d.pageIndex))}
                  className="hover:bg-muted flex w-full items-center gap-3 p-3 text-left"
                >
                  <span className="text-sm font-medium">Page {d.pageIndex + 1}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      d.identical ? "bg-muted text-muted-foreground" : "bg-warning-soft text-warning"
                    )}
                  >
                    {d.identical ? "Identical" : d.tokens ? `${d.changeCount} changes` : "Differs (too large to diff word-by-word)"}
                  </span>
                </button>

                {expandedPage === d.pageIndex && !d.identical && (
                  <div className="border-border border-t p-3">
                    <div className="mb-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={visualLoading === d.pageIndex}
                        onClick={() => handleShowVisualDiff(d.pageIndex)}
                      >
                        {visualLoading === d.pageIndex ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3 w-3" />
                        )}
                        Visual diff
                      </Button>
                    </div>

                    {d.tokens && (
                      <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {d.tokens.map((t, i) =>
                          t.type === "equal" ? (
                            <span key={i}>{t.value}</span>
                          ) : t.type === "remove" ? (
                            <span key={i} className="bg-destructive-soft text-destructive line-through">
                              {t.value}
                            </span>
                          ) : (
                            <span key={i} className="bg-success-soft text-success">
                              {t.value}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {visualDiffs.has(d.pageIndex) && (
                      <div className="mt-3">
                        <p className="text-muted-foreground mb-1.5 text-xs">
                          Red = differs beyond a per-pixel threshold (
                          {(
                            (visualDiffs.get(d.pageIndex)!.diffPixels / visualDiffs.get(d.pageIndex)!.totalPixels) *
                            100
                          ).toFixed(1)}
                          % of the page)
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={visualDiffs.get(d.pageIndex)!.url}
                          alt={`Visual diff for page ${d.pageIndex + 1}`}
                          className="border-border max-w-full rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
