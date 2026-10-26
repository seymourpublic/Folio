import { idbDelete, idbGetAll, idbPut } from "./idb";

export type VersionMeta = {
  id: string;
  documentId: string;
  fileName: string;
  label: string;
  timestamp: number;
  byteLength: number;
};

type VersionRecord = VersionMeta & { bytes: Uint8Array };

export async function saveVersionSnapshot(
  documentId: string,
  fileName: string,
  bytes: Uint8Array,
  label: string
): Promise<VersionMeta> {
  const record: VersionRecord = {
    id: crypto.randomUUID(),
    documentId,
    fileName,
    label,
    timestamp: Date.now(),
    byteLength: bytes.length,
    bytes,
  };
  await idbPut("versions", record);
  const { bytes: _b, ...meta } = record;
  void _b;
  return meta;
}

export async function listVersions(documentId: string): Promise<VersionMeta[]> {
  const all = await idbGetAll<VersionRecord>("versions");
  return all
    .filter((v) => v.documentId === documentId)
    .map(({ bytes: _b, ...meta }) => {
      void _b;
      return meta;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getVersionBytes(id: string): Promise<Uint8Array | undefined> {
  const all = await idbGetAll<VersionRecord>("versions");
  return all.find((v) => v.id === id)?.bytes;
}

export async function deleteVersion(id: string): Promise<void> {
  await idbDelete("versions", id);
}
