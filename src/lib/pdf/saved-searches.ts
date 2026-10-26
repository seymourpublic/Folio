import { idbDelete, idbGetAll, idbPut } from "./idb";
import { createId } from "@folio/engine";

export type SavedSearch = { id: string; query: string; createdAt: number };

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const all = await idbGetAll<SavedSearch>("savedsearches");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveSearch(query: string): Promise<SavedSearch | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const existing = await listSavedSearches();
  if (existing.some((s) => s.query === trimmed)) return null;
  const record: SavedSearch = { id: createId(), query: trimmed, createdAt: Date.now() };
  await idbPut("savedsearches", record);
  return record;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await idbDelete("savedsearches", id);
}
