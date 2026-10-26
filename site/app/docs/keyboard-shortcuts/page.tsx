import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { ShortcutTable } from "@/components/shortcut-table";

export const metadata: Metadata = {
  title: "Keyboard shortcuts",
  description: "Every keyboard shortcut bound in Folio.",
  alternates: { canonical: "/docs/keyboard-shortcuts" },
};

export default function ShortcutsPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Keyboard shortcuts</h1>

      <Prose>
        <p>
          The command palette is the fastest way to reach anything, including actions with
          no bound key. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on
          macOS) and start typing.
        </p>
      </Prose>

      <ShortcutTable />

      <Prose>
        <h2>How bare keys behave</h2>
        <p>
          Shortcuts without a modifier — the arrow keys, <kbd>Home</kbd>, <kbd>End</kbd> —
          are ignored while you are typing in a text field, so page navigation does not
          fire while you are writing a comment or editing a form. Combinations with a
          modifier always fire.
        </p>
        <p>
          In a split view, only the focused pane responds. Background tabs stay loaded but
          do not react to keys.
        </p>
      </Prose>
    </>
  );
}
