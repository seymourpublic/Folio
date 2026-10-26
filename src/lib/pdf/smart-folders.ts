import { idbDelete, idbGetAll, idbPut } from "./idb";
import { createId } from "@folio/engine";

export type SmartFolder = { id: string; name: string; query: string; createdAt: number };

export async function listSmartFolders(): Promise<SmartFolder[]> {
  const all = await idbGetAll<SmartFolder>("smartfolders");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSmartFolder(name: string, query: string): Promise<SmartFolder> {
  const folder: SmartFolder = { id: createId(), name, query, createdAt: Date.now() };
  await idbPut("smartfolders", folder);
  return folder;
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await idbDelete("smartfolders", id);
}
