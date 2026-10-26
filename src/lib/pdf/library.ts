import { idbDelete, idbGet, idbGetAll, idbPut } from "./idb";
import { createId, type PdfDocumentProxy } from "@folio/engine";

export type LibraryDoc = {
  id: string;
  name: string;
  bytes: Uint8Array;
  sizeBytes: number;
  pageCount: number;
  createdAt: number;
  lastOpenedAt: number;
  favorite: boolean;
  collectionIds: string[];
  tags: string[];
  trashed: boolean;
  trashedAt: number | null;
  thumbnailDataUrl: string | null;
};

export type LibraryDocSummary = Omit<LibraryDoc, "bytes">;

export type Collection = { id: string; name: string; createdAt: number };

const THUMBNAIL_WIDTH = 240;

/** Renders a small page-1 raster for the library grid/Home cards. */
export async function generateThumbnail(doc: PdfDocumentProxy): Promise<string | null> {
  try {
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function omitBytes(record: LibraryDoc): LibraryDocSummary {
  const { bytes: _bytes, ...summary } = record;
  void _bytes;
  return summary;
}

/** Upserts a library entry for a just-opened document, deduping by name+size. Reopening a
 * trashed document restores it. */
export async function recordDocumentOpened(params: {
  name: string;
  sizeBytes: number;
  bytes: Uint8Array;
  pageCount: number;
  thumbnailDataUrl: string | null;
}): Promise<LibraryDocSummary> {
  const all = await idbGetAll<LibraryDoc>("library");
  const existing = all.find((d) => d.name === params.name && d.sizeBytes === params.sizeBytes);
  const now = Date.now();

  const record: LibraryDoc = existing
    ? {
        ...existing,
        bytes: params.bytes,
        pageCount: params.pageCount,
        lastOpenedAt: now,
        trashed: false,
        trashedAt: null,
        thumbnailDataUrl: params.thumbnailDataUrl ?? existing.thumbnailDataUrl,
      }
    : {
        id: createId(),
        name: params.name,
        bytes: params.bytes,
        sizeBytes: params.sizeBytes,
        pageCount: params.pageCount,
        createdAt: now,
        lastOpenedAt: now,
        favorite: false,
        collectionIds: [],
        tags: [],
        trashed: false,
        trashedAt: null,
        thumbnailDataUrl: params.thumbnailDataUrl,
      };

  await idbPut("library", record);
  return omitBytes(record);
}

export async function listLibraryDocs(): Promise<LibraryDocSummary[]> {
  const all = await idbGetAll<LibraryDoc>("library");
  return all.map(omitBytes).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function getLibraryDocBytes(id: string): Promise<Uint8Array | undefined> {
  const record = await idbGet<LibraryDoc>("library", id);
  return record?.bytes;
}

async function patchLibraryDoc(id: string, patch: Partial<LibraryDoc>): Promise<void> {
  const record = await idbGet<LibraryDoc>("library", id);
  if (!record) return;
  await idbPut("library", { ...record, ...patch });
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await patchLibraryDoc(id, { favorite });
}

export async function renameLibraryDoc(id: string, name: string): Promise<void> {
  await patchLibraryDoc(id, { name });
}

export async function trashLibraryDoc(id: string): Promise<void> {
  await patchLibraryDoc(id, { trashed: true, trashedAt: Date.now() });
}

export async function restoreLibraryDoc(id: string): Promise<void> {
  await patchLibraryDoc(id, { trashed: false, trashedAt: null });
}

export async function deleteLibraryDocPermanently(id: string): Promise<void> {
  await idbDelete("library", id);
}

export async function addTag(id: string, tag: string): Promise<void> {
  const record = await idbGet<LibraryDoc>("library", id);
  if (!record || record.tags.includes(tag)) return;
  await idbPut("library", { ...record, tags: [...record.tags, tag] });
}

export async function removeTag(id: string, tag: string): Promise<void> {
  const record = await idbGet<LibraryDoc>("library", id);
  if (!record) return;
  await idbPut("library", { ...record, tags: record.tags.filter((t) => t !== tag) });
}

export async function setDocCollections(id: string, collectionIds: string[]): Promise<void> {
  await patchLibraryDoc(id, { collectionIds });
}

export async function bulkSetFavorite(ids: string[], favorite: boolean): Promise<void> {
  await Promise.all(ids.map((id) => patchLibraryDoc(id, { favorite })));
}

export async function bulkTrash(ids: string[]): Promise<void> {
  const trashedAt = Date.now();
  await Promise.all(ids.map((id) => patchLibraryDoc(id, { trashed: true, trashedAt })));
}

export async function bulkRestore(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => patchLibraryDoc(id, { trashed: false, trashedAt: null })));
}

export async function bulkDeletePermanently(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => idbDelete("library", id)));
}

export async function bulkAddTag(ids: string[], tag: string): Promise<void> {
  await Promise.all(ids.map((id) => addTag(id, tag)));
}

export async function bulkAddToCollection(ids: string[], collectionId: string): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      const record = await idbGet<LibraryDoc>("library", id);
      if (!record || record.collectionIds.includes(collectionId)) return;
      await idbPut("library", { ...record, collectionIds: [...record.collectionIds, collectionId] });
    })
  );
}

export async function listCollections(): Promise<Collection[]> {
  const all = await idbGetAll<Collection>("collections");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCollection(name: string): Promise<Collection> {
  const collection: Collection = { id: createId(), name, createdAt: Date.now() };
  await idbPut("collections", collection);
  return collection;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const record = await idbGet<Collection>("collections", id);
  if (!record) return;
  await idbPut("collections", { ...record, name });
}

export async function deleteCollection(id: string): Promise<void> {
  await idbDelete("collections", id);
  const docs = await idbGetAll<LibraryDoc>("library");
  for (const doc of docs) {
    if (doc.collectionIds.includes(id)) {
      await idbPut("library", { ...doc, collectionIds: doc.collectionIds.filter((c) => c !== id) });
    }
  }
}

export type LibraryFilter =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "favorites" }
  | { kind: "collection"; id: string; name: string }
  | { kind: "tag"; tag: string }
  | { kind: "trash" }
  /** A saved, auto-updating name/tag query. */
  | { kind: "smart"; id: string; name: string; query: string };

export function matchesSmartFolderQuery(doc: LibraryDocSummary, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return doc.name.toLowerCase().includes(trimmed) || doc.tags.some((t) => t.toLowerCase().includes(trimmed));
}

export function filterLibraryDocs(docs: LibraryDocSummary[], filter: LibraryFilter): LibraryDocSummary[] {
  switch (filter.kind) {
    case "all":
      return docs.filter((d) => !d.trashed);
    case "recent":
      return docs.filter((d) => !d.trashed).slice(0, 20);
    case "favorites":
      return docs.filter((d) => !d.trashed && d.favorite);
    case "collection":
      return docs.filter((d) => !d.trashed && d.collectionIds.includes(filter.id));
    case "tag":
      return docs.filter((d) => !d.trashed && d.tags.includes(filter.tag));
    case "trash":
      return docs.filter((d) => d.trashed);
    case "smart":
      return docs.filter((d) => !d.trashed && matchesSmartFolderQuery(d, filter.query));
  }
}

export function libraryFilterLabel(filter: LibraryFilter): string {
  switch (filter.kind) {
    case "all":
      return "Library";
    case "recent":
      return "Recent";
    case "favorites":
      return "Favorites";
    case "collection":
      return filter.name;
    case "tag":
      return `#${filter.tag}`;
    case "trash":
      return "Trash";
    case "smart":
      return filter.name;
  }
}

/** Every distinct tag currently in use, for the nav rail's Tags section. */
export function distinctTags(docs: LibraryDocSummary[]): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    if (d.trashed) continue;
    for (const t of d.tags) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
