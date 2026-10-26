import type { ViewMode } from "@folio/engine";

const KEYS = {
  defaultViewMode: "acrobat-clone:default-view-mode",
  reduceMotion: "acrobat-clone:reduce-motion",
  autosaveEnabled: "acrobat-clone:autosave-enabled",
  screenTransitions: "acrobat-clone:screen-transitions",
  ocrLanguages: "acrobat-clone:ocr-languages",
  ocrDeskew: "acrobat-clone:ocr-deskew",
  ocrDenoise: "acrobat-clone:ocr-denoise",
} as const;

const VIEW_MODES: ViewMode[] = ["continuous", "single", "facing", "cover"];

export function getDefaultViewMode(): ViewMode {
  if (typeof window === "undefined") return "continuous";
  const stored = window.localStorage.getItem(KEYS.defaultViewMode);
  return VIEW_MODES.includes(stored as ViewMode) ? (stored as ViewMode) : "continuous";
}

export function setDefaultViewMode(mode: ViewMode): void {
  window.localStorage.setItem(KEYS.defaultViewMode, mode);
}

export function getReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEYS.reduceMotion) === "true";
}

export function setReduceMotion(enabled: boolean): void {
  window.localStorage.setItem(KEYS.reduceMotion, String(enabled));
  document.documentElement.classList.toggle("reduce-motion", enabled);
}

/** Governs the crossfade between Home/Library/Search/Settings/Viewer specifically. */
export function getScreenTransitionsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(KEYS.screenTransitions);
  return stored === null ? true : stored === "true";
}

export function setScreenTransitionsEnabled(enabled: boolean): void {
  window.localStorage.setItem(KEYS.screenTransitions, String(enabled));
}

export function getAutosaveEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(KEYS.autosaveEnabled);
  return stored === null ? true : stored === "true";
}

export function setAutosaveEnabled(enabled: boolean): void {
  window.localStorage.setItem(KEYS.autosaveEnabled, String(enabled));
}

export function getOcrLanguages(): string[] {
  if (typeof window === "undefined") return ["eng"];
  try {
    const stored = window.localStorage.getItem(KEYS.ocrLanguages);
    const parsed = stored ? (JSON.parse(stored) as string[]) : ["eng"];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["eng"];
  } catch {
    return ["eng"];
  }
}

export function setOcrLanguages(languages: string[]): void {
  window.localStorage.setItem(KEYS.ocrLanguages, JSON.stringify(languages.length > 0 ? languages : ["eng"]));
}

export function getOcrDeskew(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(KEYS.ocrDeskew);
  return stored === null ? true : stored === "true";
}

export function setOcrDeskew(enabled: boolean): void {
  window.localStorage.setItem(KEYS.ocrDeskew, String(enabled));
}

export function getOcrDenoise(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(KEYS.ocrDenoise);
  return stored === null ? true : stored === "true";
}

export function setOcrDenoise(enabled: boolean): void {
  window.localStorage.setItem(KEYS.ocrDenoise, String(enabled));
}
