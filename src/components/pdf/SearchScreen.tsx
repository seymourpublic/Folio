"use client";

import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, FileText, Star, X, HelpCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { listLibraryDocs, type LibraryDocSummary } from "@/lib/pdf/library";
import type { LibraryContentMatch } from "@/lib/pdf/library-index";
import { deleteSavedSearch, listSavedSearches, saveSearch, type SavedSearch } from "@/lib/pdf/saved-searches";
import { collectContentTerms, evaluateQuery, isAdvancedQuery, parseQuery } from "@/lib/pdf/query-language";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SearchScreenProps = {
  onOpenLibraryDoc: (doc: LibraryDocSummary) => void;
};

const RECENT_SEARCHES_KEY = "acrobat-clone:recent-searches";
const MAX_RECENT_SEARCHES = 8;

function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const existing = loadRecentSearches().filter((q) => q !== query);
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify([query, ...existing].slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Best-effort — history just won't persist if storage is unavailable.
  }
}

/** Searches document names, tags and page content across the whole library — unlike the
 * command palette, which searches only the open document. */
export function SearchScreen({ onOpenLibraryDoc }: SearchScreenProps) {
  const [allDocs, setAllDocs] = useState<LibraryDocSummary[]>([]);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [contentMatches, setContentMatches] = useState<LibraryContentMatch[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const [contentTermMatches, setContentTermMatches] = useState<Map<string, Set<string>>>(new Map());

  const contentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRequestId = useRef(0);

  useEffect(() => {
    listLibraryDocs().then(setAllDocs);
    listSavedSearches().then(setSavedSearches);
    return () => {
      if (contentDebounce.current) clearTimeout(contentDebounce.current);
    };
  }, []);

  const isCurrentQuerySaved = savedSearches.some((s) => s.query === query.trim());

  async function toggleSaveCurrentQuery() {
    if (!query.trim()) return;
    const existing = savedSearches.find((s) => s.query === query.trim());
    if (existing) {
      await deleteSavedSearch(existing.id);
    } else {
      await saveSearch(query);
    }
    setSavedSearches(await listSavedSearches());
  }

  async function removeSavedSearch(id: string) {
    await deleteSavedSearch(id);
    setSavedSearches(await listSavedSearches());
  }

  const trimmed = query.trim();
  const advanced = trimmed.length > 0 && isAdvancedQuery(trimmed);
  const parsedQuery = trimmed ? parseQuery(trimmed) : [];
  const results = trimmed
    ? allDocs.filter((d) => !d.trashed && evaluateQuery(d, parsedQuery, contentTermMatches))
    : [];

  function handleQueryChange(value: string) {
    setQuery(value);
    if (contentDebounce.current) clearTimeout(contentDebounce.current);

    const nextTrimmed = value.trim();
    if (!nextTrimmed) {
      setContentMatches([]);
      setContentTermMatches(new Map());
      setIsSearchingContent(false);
      return;
    }

    setIsSearchingContent(true);
    const requestId = ++contentRequestId.current;
    contentDebounce.current = setTimeout(() => {
      import("@/lib/pdf/library-index").then(async ({ searchLibraryContent }) => {
        if (isAdvancedQuery(nextTrimmed)) {
          const terms = collectContentTerms(parseQuery(nextTrimmed));
          const resolved = new Map<string, Set<string>>();
          for (const term of terms) {
            const matches = await searchLibraryContent(term);
            resolved.set(term, new Set(matches.map((m) => m.docId)));
          }
          if (contentRequestId.current === requestId) {
            setContentTermMatches(resolved);
            setContentMatches([]);
            setIsSearchingContent(false);
          }
          return;
        }
        const matches = await searchLibraryContent(nextTrimmed);
        if (contentRequestId.current === requestId) {
          setContentMatches(matches);
          setIsSearchingContent(false);
        }
      });
    }, 200);
  }

  function handleSubmit() {
    if (trimmed) {
      saveRecentSearch(query.trim());
      setRecentSearches(loadRecentSearches());
    }
  }

  const docById = new Map(allDocs.map((d) => [d.id, d]));

  return (
    <div className="flex-1 overflow-y-auto px-12 py-8">
      <div className="border-border bg-card mb-6 flex h-11 items-center gap-2.5 rounded-xl border px-3.5">
        <SearchIcon className="text-muted-foreground h-4 w-4" />
        <input
          autoFocus
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          onBlur={handleSubmit}
          placeholder='Search, or try tag:invoice pages>10 OR name:"annual report"'
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <Tooltip>
          <TooltipTrigger render={<button type="button" className="text-muted-foreground hover:text-foreground shrink-0" />}>
            <HelpCircle className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64 flex-col items-start gap-1 text-left">
            <p className="font-medium">Query syntax</p>
            <p>
              Fields: <code>tag:</code> <code>name:</code> <code>content:</code> <code>favorite:</code>{" "}
              <code>pages</code> <code>size</code> <code>date</code> <code>opened</code>
            </p>
            <p>
              Comparisons: <code>pages&gt;10</code> <code>size&lt;5mb</code> <code>date&gt;2025-01-01</code>
            </p>
            <p>
              Combine with <code>OR</code>, negate with <code>-</code>, quote phrases with{" "}
              <code>&quot; &quot;</code>
            </p>
          </TooltipContent>
        </Tooltip>
        {trimmed && (
          <button
            aria-label={isCurrentQuerySaved ? "Remove saved search" : "Save this search"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleSaveCurrentQuery}
            className={cn("shrink-0", isCurrentQuerySaved ? "text-warning" : "text-muted-foreground hover:text-foreground")}
          >
            <Star className="h-4 w-4" fill={isCurrentQuerySaved ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {!trimmed && (
        <>
          {savedSearches.length > 0 && (
            <>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Saved searches</h2>
              <div className="mb-6 flex flex-wrap gap-2">
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="border-border bg-card flex items-center gap-1 rounded-full border py-1.5 pr-1.5 pl-3 text-xs"
                  >
                    <button onClick={() => handleQueryChange(s.query)}>{s.query}</button>
                    <button
                      aria-label={`Remove saved search "${s.query}"`}
                      onClick={() => removeSavedSearch(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Recent searches</h2>
          {recentSearches.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing searched yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQueryChange(q)}
                  className="border-border bg-card rounded-full border px-3 py-1.5 text-xs"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {trimmed && (
        <>
          {results.length === 0 && advanced && (
            <p className="text-muted-foreground mb-6 text-sm">No documents match that query.</p>
          )}
          {results.length > 0 && (
            <>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {advanced ? "Matching documents" : "Name & tag matches"}
              </h2>
              <div className="mb-6 flex flex-col gap-1">
                {results.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      handleSubmit();
                      onOpenLibraryDoc(d);
                    }}
                    className="hover:bg-muted flex items-start gap-3.5 rounded-xl p-3.5 text-left"
                  >
                    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                      {d.thumbnailDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.thumbnailDataUrl} alt="" className="h-full w-full object-cover object-top" />
                      ) : (
                        <FileText className="text-foreground-tertiary h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {d.pageCount} pages · {formatRelativeTime(d.lastOpenedAt)}
                        {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {!advanced && (
            <>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Content matches
              </h2>
              {isSearchingContent && <p className="text-muted-foreground text-sm">Searching document content…</p>}
              {!isSearchingContent && contentMatches.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No matching text found in any document&apos;s content
                  {results.length === 0 ? " or name/tags" : ""}.
                </p>
              )}
            </>
          )}
          <div className="flex flex-col gap-1">
            {!advanced && contentMatches.map((m, i) => {
              const doc = docById.get(m.docId);
              if (!doc) return null;
              return (
                <button
                  key={i}
                  onClick={() => {
                    handleSubmit();
                    onOpenLibraryDoc(doc);
                  }}
                  className="hover:bg-muted flex items-start gap-3.5 rounded-xl p-3.5 text-left"
                >
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    {doc.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.thumbnailDataUrl} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      <FileText className="text-foreground-tertiary h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {doc.name} <span className="text-muted-foreground font-normal">· page {m.pageIndex + 1}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs">{m.snippet}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
