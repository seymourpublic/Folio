import { useEffect, useState } from "react";
import { downloadBytes } from "@folio/engine";

export type ElectronOpenFilePayload = { name: string; bytes: Uint8Array };
export type WatchedFileAddedPayload = { folderPath: string; filePath: string; name: string; bytes: Uint8Array };

declare global {
  interface Window {
    electronAPI?: {
      onOpenFile: (callback: (payload: ElectronOpenFilePayload) => void) => void;
      saveFile: (
        bytes: Uint8Array,
        suggestedName: string,
        extension?: string
      ) => Promise<{ saved: boolean; filePath?: string }>;
      newWindow: () => Promise<void>;
      pickFolderToWatch: () => Promise<string | null>;
      addWatchedFolder: (folderPath: string) => Promise<string[]>;
      removeWatchedFolder: (folderPath: string) => Promise<string[]>;
      listWatchedFolders: () => Promise<string[]>;
      onWatchedFileAdded: (callback: (payload: WatchedFileAddedPayload) => void) => void;
      tsaRequest: (url: string, body: Uint8Array) => Promise<Uint8Array>;
    };
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/** Hydration-safe `isElectron()`: starts `false` on every render, flips in an effect. */
export function useIsElectron(): boolean {
  const [electron, setElectron] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElectron(isElectron());
  }, []);
  return electron;
}

export async function saveOrDownloadPdf(bytes: Uint8Array, fileName: string): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.saveFile(bytes, fileName, "pdf");
  } else {
    downloadBytes(bytes, fileName, "application/pdf");
  }
}

export async function saveOrDownloadZip(bytes: Uint8Array, fileName: string): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.saveFile(bytes, fileName, "zip");
  } else {
    downloadBytes(bytes, fileName, "application/zip");
  }
}

export async function saveOrDownloadSvg(svg: string, fileName: string): Promise<void> {
  const bytes = new TextEncoder().encode(svg);
  if (isElectron()) {
    await window.electronAPI!.saveFile(bytes, fileName, "svg");
  } else {
    downloadBytes(bytes, fileName, "image/svg+xml");
  }
}

/** Generic save path for the conversion formats — one function instead of a dedicated
 * wrapper per extension. `extension` (no dot) drives both the Electron save-dialog filter
 * and, indirectly, the browser download's file extension via `fileName`. */
export async function saveOrDownloadFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  extension: string
): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.saveFile(bytes, fileName, extension);
  } else {
    downloadBytes(bytes, fileName, mimeType);
  }
}

/** Folder watching ("hot folder" auto-import) is desktop-only. */
export async function pickFolderToWatch(): Promise<string | null> {
  if (!isElectron()) return null;
  return window.electronAPI!.pickFolderToWatch();
}

export async function addWatchedFolder(folderPath: string): Promise<string[]> {
  if (!isElectron()) return [];
  return window.electronAPI!.addWatchedFolder(folderPath);
}

export async function removeWatchedFolder(folderPath: string): Promise<string[]> {
  if (!isElectron()) return [];
  return window.electronAPI!.removeWatchedFolder(folderPath);
}

export async function listWatchedFolders(): Promise<string[]> {
  if (!isElectron()) return [];
  return window.electronAPI!.listWatchedFolders();
}

export function onWatchedFileAdded(callback: (payload: WatchedFileAddedPayload) => void): void {
  if (!isElectron()) return;
  window.electronAPI!.onWatchedFileAdded(callback);
}

/** RFC3161 timestamp requests, routed through the main process to sidestep CORS.
 * Undefined in the browser build, where rfc3161.ts falls back to `fetch`. */
export function electronTsaTransport(): ((url: string, body: Uint8Array) => Promise<Uint8Array>) | undefined {
  if (!isElectron()) return undefined;
  return (url, body) => window.electronAPI!.tsaRequest(url, body);
}
