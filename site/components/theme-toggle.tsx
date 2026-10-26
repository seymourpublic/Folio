"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { getServerSnapshot, getSnapshot, setDark, subscribe } from "@/lib/theme";

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Hydration reconciles <html class> and drops what the layout's pre-paint script
  // added, so the class is reapplied here. The script still earns its place: it
  // prevents a flash in the window before React takes over.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setDark(!isDark)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-9 place-items-center rounded-lg text-secondary transition-colors hover:bg-surface-sunken hover:text-primary"
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
