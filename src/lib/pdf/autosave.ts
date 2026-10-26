import { idbDelete, idbGet, idbGetAll, idbPut } from "./idb";
import type { BookmarkNode, DocPage, DocumentMetadata, PageNumberingOptions, WatermarkOptions, EncryptionOptions } from "@folio/engine";

export type AutosaveSourceRecord = { id: string; name: string; bytes: Uint8Array };

export type AutosaveRecord = {
  id: string; // documentId
  fileName: string;
  timestamp: number;
  sources: AutosaveSourceRecord[];
  pages: DocPage[];
  watermark: WatermarkOptions | null;
  encryption: EncryptionOptions | null;
  metadata: DocumentMetadata;
  bookmarks: BookmarkNode[];
  pageNumbering: PageNumberingOptions | null;
};

export type AutosaveSummary = { id: string; fileName: string; timestamp: number };

export async function saveAutosave(record: AutosaveRecord): Promise<void> {
  await idbPut("autosave", record);
}

export async function listAutosaves(): Promise<AutosaveSummary[]> {
  const all = await idbGetAll<AutosaveRecord>("autosave");
  return all
    .map(({ id, fileName, timestamp }) => ({ id, fileName, timestamp }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getAutosave(id: string): Promise<AutosaveRecord | undefined> {
  return idbGet<AutosaveRecord>("autosave", id);
}

export async function deleteAutosave(id: string): Promise<void> {
  await idbDelete("autosave", id);
}
