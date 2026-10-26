"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "acrobat-clone:theme";
const REDUCE_MOTION_KEY = "acrobat-clone:reduce-motion";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The theme is client-only state that also has to exist before hydration, so it
 * lives outside React. Reading it through useSyncExternalStore lets the server
 * and the client's first render agree on "light" and then correct, instead of
 * failing hydration the way a localStorage read during render would.
 */
const listeners = new Set<() => void>();
let current: Theme | null = null;

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  if (current === null) current = read();
  return current;
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Hydration reconciles <html class> and drops what the pre-paint script in
  // layout.tsx added, so both preference classes are reapplied here. The script
  // still matters: it prevents a flash in the window before this runs.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      const reduceMotion = window.localStorage.getItem(REDUCE_MOTION_KEY) === "true";
      document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    } catch {
    }
  }, [theme]);

  function setTheme(next: Theme) {
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
    }
    for (const listener of listeners) listener();
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
