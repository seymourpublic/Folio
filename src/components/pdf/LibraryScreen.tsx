"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Search,
  LayoutGrid,
  Rows3,
  Star,
  MoreHorizontal,
  Layers,
  Tag,
  Pencil,
  Trash2,
  RotateCcw,
  FileText,
  AlertTriangle,
  Inbox,
  X,
  Download,
  Copy as CopyIcon,
} from "lucide-react";
import JSZip from "jszip";
import { cn } from "@/lib/utils";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { NearDuplicatesDialog } from "./NearDuplicatesDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  addTag,
  bulkAddTag,
  bulkAddToCollection,
  bulkDeletePermanently,
  bulkRestore,
  bulkSetFavorite,
  bulkTrash,
  createCollection,
  deleteLibraryDocPermanently,
  distinctTags,
  filterLibraryDocs,
  getLibraryDocBytes,
  libraryFilterLabel,
  listCollections,
  listLibraryDocs,
  removeTag,
  renameLibraryDoc,
  restoreLibraryDoc,
  setDocCollections,
  setFavorite,
  trashLibraryDoc,
  type Collection,
  type LibraryDocSummary,
  type LibraryFilter,
} from "@/lib/pdf/library";
import { saveOrDownloadFile } from "@/lib/electron-bridge";

type LibraryScreenProps = {
  filter: LibraryFilter;
  onOpenLibraryDoc: (doc: LibraryDocSummary) => void;
  onChanged: () => void;
  refreshToken: number;
};

type LoadState = "loading" | "loaded" | "error";

export function LibraryScreen({ filter, onOpenLibraryDoc, onChanged, refreshToken }: LibraryScreenProps) {
  const [allDocs, setAllDocs] = useState<LibraryDocSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<LibraryDocSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);

  const [prevRefreshToken, setPrevRefreshToken] = useState(refreshToken);
  if (refreshToken !== prevRefreshToken) {
    setPrevRefreshToken(refreshToken);
    setLoadState("loading");
  }

  useEffect(() => {
    Promise.all([listLibraryDocs(), listCollections()])
      .then(([docs, cols]) => {
        setAllDocs(docs);
        setCollections(cols);
        setLoadState("loaded");
      })
      .catch(() => setLoadState("error"));
  }, [refreshToken]);

  const filterKey =
    filter.kind === "collection"
      ? `collection:${filter.id}`
      : filter.kind === "tag"
        ? `tag:${filter.tag}`
        : filter.kind === "smart"
          ? `smart:${filter.id}`
          : filter.kind;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setSelectedIds(new Set());
  }

  const allTags = useMemo(() => distinctTags(allDocs), [allDocs]);

  const docs = useMemo(() => {
    const scoped = filterLibraryDocs(allDocs, filter);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return scoped;
    return scoped.filter((d) => d.name.toLowerCase().includes(trimmed));
  }, [allDocs, filter, query]);

  function refetch() {
    listLibraryDocs().then(setAllDocs);
    onChanged();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(docs.map((d) => d.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedDocs = useMemo(
    () => docs.filter((d) => selectedIds.has(d.id)),
    [docs, selectedIds]
  );

  async function runBulk(action: () => Promise<void>) {
    setIsBulkWorking(true);
    try {
      await action();
      clearSelection();
      refetch();
    } finally {
      setIsBulkWorking(false);
    }
  }

  async function handleBulkNewCollection() {
    const name = window.prompt("New collection name");
    if (!name?.trim()) return;
    const collection = await createCollection(name.trim());
    setCollections((prev) => [...prev, collection]);
    await runBulk(() => bulkAddToCollection([...selectedIds], collection.id));
  }

  async function handleBulkNewTag() {
    const tag = window.prompt("New tag");
    if (!tag?.trim()) return;
    await runBulk(() => bulkAddTag([...selectedIds], tag.trim()));
  }

  async function handleBulkExportZip() {
    setIsBulkWorking(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const doc of selectedDocs) {
        const bytes = await getLibraryDocBytes(doc.id);
        if (!bytes) continue;
        let name = doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`;
        while (usedNames.has(name)) name = `${name.replace(/\.pdf$/, "")}-copy.pdf`;
        usedNames.add(name);
        zip.file(name, bytes);
      }
      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      await saveOrDownloadFile(zipBytes, "documents.zip", "application/zip", "zip");
    } finally {
      setIsBulkWorking(false);
    }
  }

  async function handleNewCollection(docId: string, currentIds: string[]) {
    const name = window.prompt("New collection name");
    if (!name?.trim()) return;
    const collection = await createCollection(name.trim());
    setCollections((prev) => [...prev, collection]);
    await setDocCollections(docId, [...currentIds, collection.id]);
    refetch();
  }

  async function handleNewTag(docId: string) {
    const tag = window.prompt("New tag");
    if (!tag?.trim()) return;
    await addTag(docId, tag.trim());
    refetch();
  }

  function openRename(doc: LibraryDocSummary) {
    setRenameTarget(doc);
    setRenameDraft(doc.name);
  }

  async function commitRename() {
    if (!renameTarget || !renameDraft.trim()) return;
    await renameLibraryDoc(renameTarget.id, renameDraft.trim());
    setRenameTarget(null);
    refetch();
  }

  function DocMenu({ doc }: { doc: LibraryDocSummary }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label="Document actions"
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e: MouseEvent) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setFavorite(doc.id, !doc.favorite).then(refetch)}>
            <Star className="h-4 w-4" />
            {doc.favorite ? "Remove from Favorites" : "Add to Favorites"}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Layers className="h-4 w-4" />
              Collections
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {collections.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={doc.collectionIds.includes(c.id)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...doc.collectionIds, c.id]
                      : doc.collectionIds.filter((id) => id !== c.id);
                    setDocCollections(doc.id, next).then(refetch);
                  }}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
              {collections.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => handleNewCollection(doc.id, doc.collectionIds)}>
                New collection…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="h-4 w-4" />
              Tags
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {allTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={doc.tags.includes(tag)}
                  onCheckedChange={(checked) => {
                    (checked ? addTag(doc.id, tag) : removeTag(doc.id, tag)).then(refetch);
                  }}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
              {allTags.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => handleNewTag(doc.id)}>New tag…</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => openRename(doc)}>
            <Pencil className="h-4 w-4" />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {doc.trashed ? (
            <>
              <DropdownMenuItem onClick={() => restoreLibraryDoc(doc.id).then(refetch)}>
                <RotateCcw className="h-4 w-4" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (window.confirm(`Permanently delete "${doc.name}"? This can't be undone.`)) {
                    deleteLibraryDocPermanently(doc.id).then(refetch);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => trashLibraryDoc(doc.id).then(refetch)}>
              <Trash2 className="h-4 w-4" />
              Move to Trash
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-12 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{libraryFilterLabel(filter)}</h1>
      </div>

      <div className="mb-6 flex items-center gap-2.5">
        <div className="border-border bg-card text-muted-foreground flex h-9 flex-1 items-center gap-2 rounded-xl border px-3">
          <Search className="h-3.5 w-3.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this library"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsDuplicatesOpen(true)}>
          <CopyIcon className="h-3.5 w-3.5" />
          Find duplicates
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
          onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
        >
          {viewMode === "grid" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>
      </div>

      <NearDuplicatesDialog open={isDuplicatesOpen} onOpenChange={setIsDuplicatesOpen} />

      {selectedIds.size > 0 && (
        <div className="border-border bg-card mb-4 flex flex-wrap items-center gap-2 rounded-xl border p-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Clear selection" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button variant="ghost" size="sm" className="h-8" onClick={selectAllVisible}>
            Select all {docs.length}
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={isBulkWorking}
              onClick={() => runBulk(() => bulkSetFavorite([...selectedIds], true))}
            >
              <Star className="h-3.5 w-3.5" />
              Favorite
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" disabled={isBulkWorking} />}>
                <Layers className="h-3.5 w-3.5" />
                Add to collection
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {collections.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => runBulk(() => bulkAddToCollection([...selectedIds], c.id))}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
                {collections.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={handleBulkNewCollection}>New collection…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" disabled={isBulkWorking} />}>
                <Tag className="h-3.5 w-3.5" />
                Add tag
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {allTags.map((tag) => (
                  <DropdownMenuItem key={tag} onClick={() => runBulk(() => bulkAddTag([...selectedIds], tag))}>
                    {tag}
                  </DropdownMenuItem>
                ))}
                {allTags.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={handleBulkNewTag}>New tag…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="h-8" disabled={isBulkWorking} onClick={handleBulkExportZip}>
              <Download className="h-3.5 w-3.5" />
              Export as ZIP
            </Button>
            {filter.kind === "trash" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={isBulkWorking}
                  onClick={() => runBulk(() => bulkRestore([...selectedIds]))}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  disabled={isBulkWorking}
                  onClick={() => {
                    if (window.confirm(`Permanently delete ${selectedIds.size} document(s)? This can't be undone.`)) {
                      runBulk(() => bulkDeletePermanently([...selectedIds]));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete permanently
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                disabled={isBulkWorking}
                onClick={() => runBulk(() => bulkTrash([...selectedIds]))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Move to Trash
              </Button>
            )}
          </div>
        </div>
      )}

      {loadState === "loading" && (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="border-border overflow-hidden rounded-2xl border">
              <div className="bg-muted h-30 animate-pulse" />
              <div className="space-y-2 p-3">
                <div className="bg-muted h-2.5 w-2/3 animate-pulse rounded" />
                <div className="bg-muted h-2 w-1/3 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {loadState === "error" && (
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="bg-destructive-soft text-destructive flex h-16 w-16 items-center justify-center rounded-2xl">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="text-base font-semibold">Couldn&apos;t load your library</div>
          <p className="text-muted-foreground max-w-xs text-center text-sm">
            Something went wrong reading your local library. Try reloading the app.
          </p>
        </div>
      )}

      {loadState === "loaded" && docs.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="bg-muted text-foreground-tertiary flex h-16 w-16 items-center justify-center rounded-2xl">
            <Inbox className="h-7 w-7" />
          </div>
          <div className="text-base font-semibold">No documents here yet</div>
          <p className="text-muted-foreground max-w-xs text-center text-sm">
            {query ? "No documents match your search." : "Open a document to see it appear here."}
          </p>
        </div>
      )}

      {loadState === "loaded" && docs.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-4 gap-4">
          {docs.map((d) => (
            <div
              key={d.id}
              onClick={() => (selectedIds.size > 0 ? toggleSelected(d.id) : onOpenLibraryDoc(d))}
              className={cn(
                "group border-border bg-card hover:border-border-strong cursor-pointer overflow-hidden rounded-2xl border",
                selectedIds.has(d.id) && "border-primary ring-primary/30 ring-2"
              )}
            >
              <div className="bg-muted relative h-30">
                {d.thumbnailDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnailDataUrl} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="text-foreground-tertiary flex h-full items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
                {d.favorite && (
                  <Star className="text-warning absolute top-2.5 right-2.5 h-4 w-4" fill="currentColor" />
                )}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelected(d.id);
                  }}
                  className={cn(
                    "absolute top-2.5 left-2.5 rounded-md bg-white/90 p-0.5 shadow-sm transition-opacity",
                    selectedIds.has(d.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelected(d.id)} />
                </div>
              </div>
              <div className="flex items-center gap-1 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{d.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    {formatRelativeTime(d.lastOpenedAt)} · {d.pageCount}p
                  </div>
                </div>
                <DocMenu doc={d} />
              </div>
            </div>
          ))}
        </div>
      )}

      {loadState === "loaded" && docs.length > 0 && viewMode === "list" && (
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          {docs.map((d) => (
            <div
              key={d.id}
              onClick={() => (selectedIds.size > 0 ? toggleSelected(d.id) : onOpenLibraryDoc(d))}
              className={cn(
                "group border-border flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 last:border-b-0",
                selectedIds.has(d.id) && "bg-accent"
              )}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelected(d.id);
                }}
                className={cn(
                  "shrink-0 transition-opacity",
                  selectedIds.has(d.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelected(d.id)} />
              </div>
              <div className="bg-muted h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                {d.thumbnailDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnailDataUrl} alt="" className="h-full w-full object-cover object-top" />
                )}
              </div>
              <div className="flex flex-1 items-center gap-1.5 text-sm font-medium">
                {d.favorite && <Star className="text-warning h-3.5 w-3.5 shrink-0" fill="currentColor" />}
                <span className="truncate">{d.name}</span>
              </div>
              <div className="text-muted-foreground w-36 text-xs">{formatRelativeTime(d.lastOpenedAt)}</div>
              <div className="text-muted-foreground w-16 text-xs">{formatBytes(d.sizeBytes)}</div>
              <DocMenu doc={d} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={renameTarget != null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={commitRename}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
