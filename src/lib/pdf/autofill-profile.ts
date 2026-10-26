import type { AutoFillProfile } from "@folio/engine";

const PROFILE_STORAGE_KEY = "autoFillProfile";

/** Folio's own persistence for the auto-fill profile. */
export function loadAutoFillProfile(): AutoFillProfile {
  if (typeof window === "undefined") {
    return { fullName: "", email: "", phone: "", address: "", city: "", state: "", zip: "" };
  }
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to defaults
  }
  return { fullName: "", email: "", phone: "", address: "", city: "", state: "", zip: "" };
}

export function saveAutoFillProfile(profile: AutoFillProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
