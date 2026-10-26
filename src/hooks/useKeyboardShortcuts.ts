"use client";

import { useEffect } from "react";
import type { Command } from "@/lib/commands/types";
import { isEditableEventTarget, matchesShortcut, shortcutHasModifier } from "@/lib/commands/shortcuts";

/**
 * Attaches a single document-level keydown listener that dispatches to whichever command's `shortcut` matches.
 */
export function useKeyboardShortcuts(commands: Command[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      for (const cmd of commands) {
        if (!cmd.shortcut || cmd.disabled) continue;
        if (!matchesShortcut(e, cmd.shortcut)) continue;
        if (!shortcutHasModifier(cmd.shortcut) && isEditableEventTarget(e.target)) continue;
        e.preventDefault();
        cmd.run();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commands, enabled]);
}
