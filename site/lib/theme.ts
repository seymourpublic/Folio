/**
 * The theme lives outside React because it is client-only state that also has to
 * exist before hydration. useSyncExternalStore reads it without a post-mount
 * setState, and without the server and the client's first render disagreeing.
 */
const STORAGE_KEY = "folio-site:theme";

type Listener = () => void;

const listeners = new Set<Listener>();
let current: boolean | null = null;

function read(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // Unavailable storage falls through to the system preference.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): boolean {
  if (current === null) current = read();
  return current;
}

/** The server has no preference to read, so it always renders the light default. */
export function getServerSnapshot(): boolean {
  return false;
}

export function setDark(next: boolean): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // A full or unavailable localStorage just means the choice won't persist.
  }
  for (const listener of listeners) listener();
}
