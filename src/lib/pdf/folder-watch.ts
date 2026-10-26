import { loadPdfDocument } from "@folio/engine";
import { generateThumbnail, recordDocumentOpened } from "./library";
import { indexLibraryDocument } from "./library-index";
import type { WatchedFileAddedPayload } from "@/lib/electron-bridge";

/** Loads a watched-folder arrival headlessly and records it in the library. Failures are
 * swallowed — this runs unattended, with no UI to surface an error to. */
export async function importWatchedFile(payload: WatchedFileAddedPayload): Promise<boolean> {
  try {
    const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const pdfjsDoc = await loadPdfDocument(arrayBuffer);
    const thumbnailDataUrl = await generateThumbnail(pdfjsDoc);
    const record = await recordDocumentOpened({
      name: payload.name,
      sizeBytes: bytes.byteLength,
      bytes,
      pageCount: pdfjsDoc.numPages,
      thumbnailDataUrl,
    });
    indexLibraryDocument(record.id).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
