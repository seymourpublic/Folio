import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Prose } from "@/components/prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Installation, the user guide, keyboard shortcuts and troubleshooting.",
  alternates: { canonical: "/docs" },
};

const cards = [
  {
    href: "/docs/installation",
    title: "Installation",
    body: "Install a release, or build from source on any platform.",
  },
  {
    href: "/docs/user-guide",
    title: "User guide",
    body: "Reading, annotating, editing, forms, signing and the library.",
  },
  {
    href: "/docs/keyboard-shortcuts",
    title: "Keyboard shortcuts",
    body: "Every bound key, and how the command palette works.",
  },
  {
    href: "/docs/troubleshooting",
    title: "Troubleshooting",
    body: "What to do when a document will not open, sign or export.",
  },
];

export default function DocsPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Documentation</h1>
      <Prose>
        <p>
          Folio is built so you rarely need this page. If you find yourself here because
          something was not obvious in the application, that is a design bug worth{" "}
          <a href={`${site.repo}/issues/new/choose`} target="_blank" rel="noreferrer">
            reporting
          </a>
          .
        </p>
      </Prose>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <h2 className="flex items-center gap-1.5 font-semibold tracking-tight">
              {card.title}
              <ArrowRight className="size-4 text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              {card.body}
            </p>
          </Link>
        ))}
      </div>

      <Prose>
        <h2>Where things live</h2>
        <p>
          Folio stores everything locally. Documents you add to the library, the search
          index, version history, autosave snapshots and your signing certificates are all
          kept in the browser storage of the application itself — nothing is sent
          anywhere.
        </p>
        <p>
          That means uninstalling the application removes that data, and it does not sync
          between machines. Your original files on disk are untouched either way.
        </p>

        <h2>Getting help</h2>
        <ul>
          <li>
            <a href={site.discussions} target="_blank" rel="noreferrer">
              Discussions
            </a>{" "}
            for questions and ideas
          </li>
          <li>
            <a href={site.issues} target="_blank" rel="noreferrer">
              Issues
            </a>{" "}
            for bugs and feature requests
          </li>
          <li>
            <a
              href={`${site.repo}/blob/main/ARCHITECTURE.md`}
              target="_blank"
              rel="noreferrer"
            >
              Architecture
            </a>{" "}
            if you want to understand how it works internally
          </li>
        </ul>
      </Prose>
    </>
  );
}
