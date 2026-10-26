"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Replace, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchDocument, type PdfDocumentProxy, type DocPage, type SearchMatch } from "@folio/engine";

type PdfSearchPanelProps = {
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelectMatch: (pageId: string) => void;
  /** Replaces the first not-yet-replaced occurrence of the current query on `match.pageId`.
   * Resolves false when no matching text-layer span exists (e.g. an OCR-only match). */
  onReplaceMatch: (match: SearchMatch, replacement: string) => Promise<boolean>;
};

export function PdfSearchPanel({
  pages,
  pdfjsDocs,
  onClose,
  onQueryChange,
  onSelectMatch,
  onReplaceMatch,
}: PdfSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceValue, setReplaceValue] = useState("");
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isReplacingAll, setIsReplacingAll] = useState(false);
  const [replaceAllSummary, setReplaceAllSummary] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    onQueryChange(value);
    setReplaceAllSummary(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      searchDocument(pages, pdfjsDocs, trimmed).then((matches) => {
        if (requestIdRef.current === requestId) {
          setResults(matches);
          setIsSearching(false);
        }
      });
    }, 250);
  }

  async function handleReplaceOne(index: number) {
    const match = results[index];
    if (!match || !replaceValue) return;
    setReplacingIndex(index);
    const ok = await onReplaceMatch(match, replaceValue);
    setReplacingIndex(null);
    if (ok) setResults((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleReplaceAll() {
    if (!results.length || !replaceValue) return;
    setIsReplacingAll(true);
    setReplaceAllSummary(null);
    let successCount = 0;
    for (const match of results) {
      if (await onReplaceMatch(match, replaceValue)) successCount++;
    }
    setIsReplacingAll(false);
    setReplaceAllSummary(
      successCount === results.length
        ? `Replaced ${successCount} of ${successCount}.`
        : `Replaced ${successCount} of ${results.length} — some matches had no editable text on the page (e.g. scanned/OCR text).`
    );
    setResults([]);
  }

  return (
    <div className="bg-background flex w-72 shrink-0 flex-col border-l">
      <div className="flex items-center gap-2 border-b p-2">
        <Input
          autoFocus
          placeholder="Search in document…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="h-8"
        />
        <Button
          variant={showReplace ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Replace"
          onClick={() => setShowReplace((v) => !v)}
        >
          <Replace className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-2 border-b p-2">
          <Input
            placeholder="Replace with…"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            className="h-8"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={!replaceValue || !results.length || isReplacingAll}
            onClick={handleReplaceAll}
          >
            {isReplacingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace all"}
          </Button>
        </div>
      )}
      <div className="text-muted-foreground flex items-center gap-1 px-3 py-1 text-xs">
        {isSearching && <Loader2 className="h-3 w-3 animate-spin" />}
        {!isSearching && query.trim() && !replaceAllSummary && (
          <span>
            {results.length} match{results.length === 1 ? "" : "es"}
          </span>
        )}
        {replaceAllSummary && <span>{replaceAllSummary}</span>}
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {results.map((match, i) => (
            <div key={i} className="hover:bg-accent flex items-start gap-1 rounded-md p-2">
              <button
                onClick={() => onSelectMatch(match.pageId)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              >
                <span className="text-muted-foreground text-xs font-medium">
                  Page {match.pageLabel}
                </span>
                <span className="text-sm leading-snug">{match.snippet}</span>
              </button>
              {showReplace && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={!replaceValue || replacingIndex !== null || isReplacingAll}
                  onClick={() => handleReplaceOne(i)}
                >
                  {replacingIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : "Replace"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
