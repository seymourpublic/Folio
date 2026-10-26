import type { Metadata } from "next";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/button";
import { Reveal } from "@/components/reveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What Folio does today, and what is planned next.",
  alternates: { canonical: "/roadmap" },
};

const shipped = [
  "Rendering, annotation, page organization and export",
  "AcroForm filling and form building",
  "AES-128 and AES-256 encryption, permissions, redaction",
  "Certificate signing with RFC 3161 timestamps",
  "OCR with deskew, barcode scanning",
  "Library with inverted-index search, tags, collections, smart folders",
  "Plugin runtime and command palette",
];

const planned = [
  {
    title: "Signed and notarized installers",
    body: "Code-signed builds for all three platforms, so first launch stops warning people.",
  },
  {
    title: "Linux packaging",
    body: "Flatpak and distribution packages alongside the AppImage.",
  },
  {
    title: "Incremental save",
    body: "Append-only updates rather than rewriting the whole file, so saving a large document stays fast and signatures survive.",
  },
  {
    title: "PDF/A and PDF/UA",
    body: "Conformance checking and conversion for archival and accessibility standards.",
  },
  {
    title: "Colour management",
    body: "ICC-aware rendering and export for print work.",
  },
  {
    title: "Tagged PDF authoring",
    body: "Creating and repairing structure tags, not just inspecting them.",
  },
  {
    title: "Arabic contextual shaping",
    body: "Proper cursive letterforms in text export. Hebrew and other non-cursive RTL scripts already work.",
  },
  {
    title: "A stable plugin API",
    body: "Versioning guarantees and a real capability boundary, so plugins stop being fully trusted code.",
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-section">
      <Reveal>
        <h1 className="text-4xl font-semibold sm:text-5xl">Roadmap</h1>
        <p className="mt-6 leading-relaxed text-secondary">
          Folio is pre-1.0. The list below is what works today and what comes next. It is
          not a schedule — this is a project built in the open, and priorities shift with
          what people actually report.
        </p>
      </Reveal>

      <section className="mt-14">
        <h2 className="text-sm font-semibold tracking-wide text-tertiary uppercase">
          Working today
        </h2>
        <ul className="mt-5 space-y-3">
          {shipped.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed">
              <Check
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold tracking-wide text-tertiary uppercase">
          Planned
        </h2>
        <ul className="mt-5 space-y-6">
          {planned.map((item) => (
            <li key={item.title} className="flex gap-3">
              <Circle
                className="mt-1 size-4 shrink-0 text-tertiary"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-secondary">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20 rounded-xl border border-border bg-surface p-card">
        <h2 className="text-lg font-semibold">Something missing from this list?</h2>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Open an issue describing the workflow you are stuck on. A problem is more useful
          than a feature name — it usually turns out there is a better answer than the one
          that was asked for.
        </p>
        <div className="mt-6">
          <Button href={`${site.repo}/issues/new/choose`} external>
            Open an issue
          </Button>
        </div>
      </section>
    </div>
  );
}
