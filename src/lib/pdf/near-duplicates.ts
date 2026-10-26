import { idbGet } from "./idb";
import { listLibraryDocs } from "./library";
import { computeSimHash, hammingDistance } from "@folio/engine";

type PageTextRecord = { id: string; docId: string; pageIndex: number; text: string };

export type NearDuplicatePair = {
  docIdA: string;
  docIdB: string;
  nameA: string;
  nameB: string;
  distance: number;
};

/**
 * Bits of Hamming distance allowed between two 64-bit SimHash fingerprints before they stop counting as "near-duplicate".
 */
const DISTANCE_THRESHOLD = 12;

/**
 * Reuses the per-page text already captured by the library-wide content index (library-index.ts) rather than re-parsing every PDF.
 */
async function computeLibrarySimHashes(): Promise<Map<string, { name: string; hash: bigint }>> {
  const docs = await listLibraryDocs();
  const result = new Map<string, { name: string; hash: bigint }>();

  for (const doc of docs) {
    if (doc.trashed) continue;
    let combinedText = "";
    for (let i = 0; i < doc.pageCount; i++) {
      const record = await idbGet<PageTextRecord>("libpagetext", `${doc.id}:${i}`);
      if (record) combinedText += record.text + " ";
    }
    if (!combinedText.trim()) continue; // not indexed yet, or genuinely empty
    result.set(doc.id, { name: doc.name, hash: computeSimHash(combinedText) });
  }

  return result;
}

/** O(n^2) pairwise comparison; each comparison is one XOR + popcount on 64-bit SimHashes. */
export async function findNearDuplicates(threshold = DISTANCE_THRESHOLD): Promise<NearDuplicatePair[]> {
  const hashes = await computeLibrarySimHashes();
  const entries = Array.from(hashes.entries());
  const pairs: NearDuplicatePair[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [docIdA, a] = entries[i];
      const [docIdB, b] = entries[j];
      const distance = hammingDistance(a.hash, b.hash);
      if (distance <= threshold) {
        pairs.push({ docIdA, docIdB, nameA: a.name, nameB: b.name, distance });
      }
    }
  }

  return pairs.sort((x, y) => x.distance - y.distance);
}
