import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Download, Monitor, Terminal } from "lucide-react";
import { latestAsset, platforms, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Download",
  description: `Download ${site.name} for Windows. Free and open source; macOS and Linux can build from source.`,
  alternates: { canonical: "/download" },
};

const icons = {
  windows: Monitor,
  macos: Apple,
  linux: Terminal,
} as const;

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-section">
      <div className="text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">Download Folio</h1>
        <p className="mx-auto mt-6 max-w-xl leading-relaxed text-secondary">
          Free and open source. No account, no trial, no subscription.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {platforms.map((platform) => {
          const Icon = icons[platform.id];
          if (!platform.available) {
            return (
              <div
                key={platform.id}
                className="rounded-xl border border-border bg-surface p-card opacity-70"
              >
                <Icon className="size-5 stroke-[1.5] text-tertiary" />
                <h2 className="mt-5 font-semibold">{platform.name}</h2>
                <p className="mt-1 text-sm text-secondary">Installer coming soon</p>
                <p className="mt-5 text-xs text-tertiary">{platform.requirement}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-secondary">
                  Build from source below
                </span>
              </div>
            );
          }
          return (
            <a
              key={platform.id}
              href={latestAsset(platform.file)}
              className="group rounded-xl border border-border bg-surface p-card shadow-subtle transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift motion-reduce:transform-none"
            >
              <Icon className="size-5 stroke-[1.5] text-tertiary transition-colors group-hover:text-primary" />
              <h2 className="mt-5 font-semibold">{platform.name}</h2>
              <p className="mt-1 text-sm text-secondary">{platform.format}</p>
              <p className="mt-5 text-xs text-tertiary">{platform.requirement}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                <Download className="size-4 stroke-[1.5]" />
                Download
              </span>
            </a>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-tertiary">
        Looking for a specific version? Browse{" "}
        <a
          href={site.releases}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-primary"
        >
          all releases
        </a>
        .
      </p>

      <section className="mt-20 rounded-xl border border-border bg-surface p-8">
        <h2 className="text-xl font-semibold tracking-tight">Build from source</h2>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Requires Node.js 20.9 or later.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-sm">
          <code>{`git clone ${site.repo}.git
cd folio
npm install
npm run electron:dev`}</code>
        </pre>
        <p className="mt-4 text-sm text-secondary">
          Full instructions are in the{" "}
          <Link
            href="/docs/installation"
            className="text-accent underline underline-offset-4"
          >
            installation guide
          </Link>
          .
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          A note on unsigned builds
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Folio&apos;s installer is not yet code-signed, so Windows SmartScreen will warn
          you the first time you run it. Code signing certificates
          are a recurring cost that a pre-1.0 project has not taken on yet — it is on the{" "}
          <Link href="/roadmap" className="text-accent underline underline-offset-4">
            roadmap
          </Link>
          .
        </p>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Until then, choose <strong>More info → Run anyway</strong>. If you would rather
          not trust an unsigned binary, building from source above gives you the same
          application from code you can read.
        </p>
      </section>
    </div>
  );
}
