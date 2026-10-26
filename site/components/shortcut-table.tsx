"use client";

import { useSyncExternalStore } from "react";
import { formatShortcut, shortcutGroups } from "@/lib/shortcuts";

// The platform never changes, so there is nothing to subscribe to. Reading it
// through useSyncExternalStore keeps the server rendering the non-Mac labels
// while the client corrects them, with no post-mount setState.
const noop = () => () => {};
const getPlatform = (): "mac" | "other" =>
  navigator.platform?.toLowerCase().includes("mac") ? "mac" : "other";
const getServerPlatform = (): "mac" | "other" => "other";

export function ShortcutTable() {
  const platform = useSyncExternalStore(noop, getPlatform, getServerPlatform);

  return (
    <div className="mt-10 space-y-10">
      {shortcutGroups.map((group) => (
        <section key={group.title}>
          <h2 className="text-xs font-semibold tracking-wide text-tertiary uppercase">
            {group.title}
          </h2>
          <table className="mt-3 w-full text-left text-sm">
            <tbody>
              {group.items.map((item) => (
                <tr key={item.label} className="border-b border-border">
                  <td className="py-2.5 text-secondary">{item.label}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      {formatShortcut(item.shortcut, platform).map((key, index) => (
                        <kbd
                          key={`${item.label}-${index}`}
                          className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
