import Link from "next/link";
import {
  Accessibility,
  Bookmark,
  Columns2,
  Gauge,
  Keyboard,
  MessageSquare,
  Printer,
  Search,
  Layers,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/button";
import { CountUp } from "@/components/count-up";
import { HeroMedia } from "@/components/hero-media";
import { Reveal } from "@/components/reveal";
import { Screenshot } from "@/components/screenshot";
import { measuredAt, metrics, statistics } from "@/lib/metrics";
import { site } from "@/lib/site";

const pillars = [
  {
    icon: Gauge,
    title: "Speed",
    body: "Pages render as they approach the viewport and release their bitmaps once they leave. Document length stops being a memory question.",
  },
  {
    icon: Layers,
    title: "Modern interface",
    body: "No ribbons, no floating palettes. Tools appear when the mode calls for them, and every action is one keystroke from the command palette.",
  },
  {
    icon: PenLine,
    title: "Professional editing",
    body: "Forms, redaction, OCR, encryption and cryptographic signatures — the work people actually keep Acrobat around for.",
  },
];

const showcase = [
  {
    id: "viewer",
    eyebrow: "Viewer",
    title: "The document, and very little else",
    body: "Multi-tab and split view, continuous or single-page scrolling, outline, bookmarks, layers and attachments. Chrome stays out of the way until a mode calls for it.",
    src: "/shot-viewer.png",
    darkSrc: "/shot-viewer-dark.png",
    alt: "Folio viewing a contract, with page thumbnails on the left and the view toolbar above",
  },
  {
    id: "annotate",
    eyebrow: "Annotation and editing",
    title: "Mark up without flattening anything",
    body: "Highlight, ink, shapes, stamps and notes stay editable as real objects and are only flattened on export. Text edits sit over the original glyphs, so a date or a name changes without reflowing the page.",
    src: "/shot-annotate.png",
    alt: "The annotation toolbar open over a document in Folio",
  },
  {
    id: "organize",
    eyebrow: "Page organization",
    title: "Rearrange a document by looking at it",
    body: "Drag to reorder, rotate, duplicate, extract or delete. Merge several documents or split one apart, then export once when the shape is right.",
    src: "/shot-organize.png",
    alt: "Folio's organize view showing a grid of page thumbnails with reorder controls",
  },
  {
    id: "forms",
    eyebrow: "Forms",
    title: "Fill them, or build them",
    body: "Existing AcroForm fields are fillable immediately. New fields carry calculation, validation and formatting rules, written as standard Acrobat actions so other readers run them too.",
    src: "/shot-forms.png",
    alt: "Form field tools in Folio",
  },
  {
    id: "search",
    eyebrow: "Search",
    title: "Across the document, and the library",
    body: "Search is backed by an inverted index built in the background, so results arrive as you type rather than after a scan. A query language narrows by tag, phrase and exclusion.",
    src: "/shot-search.png",
    alt: "Search results highlighted within a document in Folio",
  },
  {
    id: "palette",
    eyebrow: "Command palette",
    title: "Everything, one keystroke away",
    body: "Ctrl K reaches every action in the application — navigation, zoom, reading mode, signing, export — including the ones with no bound shortcut.",
    src: "/shot-command-palette.png",
    alt: "The Folio command palette open, listing navigation and view commands",
  },
];

const professional = [
  { icon: Keyboard, label: "Keyboard shortcuts" },
  { icon: Columns2, label: "Split view" },
  { icon: Layers, label: "Multiple tabs" },
  { icon: MessageSquare, label: "Threaded comments" },
  { icon: Bookmark, label: "Bookmarks and outline" },
  { icon: Search, label: "Library-wide search" },
  { icon: Printer, label: "Printing" },
  { icon: Accessibility, label: "Accessibility tags" },
];

const roadmap = [
  { phase: "Shipped", title: "Viewer", body: "Rendering, navigation, outline, layers, attachments." },
  { phase: "Shipped", title: "Editor", body: "Text and image editing, page organization, merge and split." },
  { phase: "Shipped", title: "OCR", body: "Recognition with projection-profile deskew and barcode scanning." },
  { phase: "Shipped", title: "Forms", body: "AcroForm filling and field authoring with calculation rules." },
  { phase: "In progress", title: "Plugins", body: "A stable, versioned API with a real capability boundary." },
  { phase: "Planned", title: "Standards", body: "PDF/A and PDF/UA conformance, ICC colour management." },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="grid-field pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-25"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-hero sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <h1 className="text-[2.75rem] leading-[1.06] font-semibold sm:text-6xl">
                The modern document workspace.
              </h1>
            </Reveal>

            <Reveal delay={60}>
              <p className="mx-auto mt-7 max-w-xl text-[1.0625rem] leading-relaxed text-secondary">
                Read, edit, organize and protect documents with a desktop experience
                designed for speed.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button href="/download">Download</Button>
                <Button href={site.repo} variant="secondary" external>
                  GitHub
                </Button>
                <Button href="/docs" variant="ghost">
                  Documentation
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={180} className="mt-16">
            <HeroMedia
              src="/hero.webm"
              poster="/hero-poster.png"
              alt="A recording of Folio: scrolling a contract, opening the command palette, switching to annotation mode, and collapsing the sidebar"
            />
          </Reveal>
        </div>
      </section>

      {/* Statistics */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 lg:grid-cols-4">
          {statistics.map((stat) => (
            <div key={stat.label} className="py-10 text-center">
              <div className="font-display text-2xl font-semibold">{stat.value}</div>
              <div className="mt-1.5 text-sm text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Folio */}
      <section id="features" className="scroll-mt-20 py-section">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-x-12 gap-y-card md:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 60}>
                <pillar.icon
                  className="size-5 stroke-[1.5] text-primary"
                  aria-hidden="true"
                />
                <h2 className="mt-5 text-xl font-semibold">{pillar.title}</h2>
                <p className="mt-3 leading-relaxed text-secondary">{pillar.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Product showcase */}
      <section className="pb-section">
        <div className="mx-auto max-w-6xl space-y-section px-6">
          {showcase.map((item, index) => (
            <Reveal key={item.id}>
              <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
                <div
                  className={`lg:col-span-4 ${index % 2 === 1 ? "lg:order-2" : ""}`}
                >
                  <p className="font-mono text-[11px] tracking-widest text-tertiary uppercase">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-4 text-[1.75rem] leading-tight font-semibold">
                    {item.title}
                  </h2>
                  <p className="mt-4 leading-relaxed text-secondary">{item.body}</p>
                </div>
                <div className="lg:col-span-8">
                  <Screenshot src={item.src} darkSrc={item.darkSrc} alt={item.alt} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Performance */}
      <section className="border-y border-border bg-surface py-section">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] tracking-widest text-tertiary uppercase">
                Performance
              </p>
              <h2 className="mt-4 text-3xl font-semibold">Measured, not asserted</h2>
              <p className="mt-4 leading-relaxed text-secondary">
                Every figure below was taken from a production build on a 1600×1000
                viewport, as the median of three warm runs. Anything that could not be
                measured is not claimed.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
              <Reveal key={metric.label} delay={index * 60}>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tracking-tight">
                    <CountUp value={metric.value} />
                  </span>
                  <span className="text-sm text-tertiary">{metric.unit}</span>
                </div>
                <h3 className="mt-3 text-sm font-medium">{metric.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  {metric.detail}
                </p>
              </Reveal>
            ))}
          </div>

          <p className="mt-12 font-mono text-xs text-tertiary">
            Measured {measuredAt} · Windows 11 · Chromium
          </p>
        </div>
      </section>

      {/* Built for professionals */}
      <section className="py-section">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="max-w-xl text-3xl font-semibold">Built for people who work in documents all day</h2>
          </Reveal>
          <Reveal delay={60}>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {professional.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 bg-surface p-card transition-colors duration-150 hover:bg-surface-sunken"
                >
                  <item.icon
                    className="size-[18px] shrink-0 stroke-[1.5] text-tertiary"
                    aria-hidden="true"
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Open source */}
      <section className="border-y border-border bg-surface py-section">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <p className="font-mono text-[11px] tracking-widest text-tertiary uppercase">
                Open source
              </p>
              <h2 className="mt-4 text-3xl font-semibold">
                Built in the open, on purpose
              </h2>
              <p className="mt-4 leading-relaxed text-secondary">
                Document software asks for a lot of trust. It reads your contracts, holds
                your signing keys, and decides what a redaction really removes. That case
                is easier to make when the code is readable.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={site.repo} variant="secondary" external>
                  Read the source
                </Button>
                <Button
                  href={`${site.repo}/blob/main/CONTRIBUTING.md`}
                  variant="ghost"
                  external
                >
                  Contributing guide
                </Button>
              </div>
            </Reveal>

            <Reveal delay={80} className="lg:col-span-7">
              <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {[
                  {
                    term: "GPL-3.0 application",
                    desc: "Forks of Folio itself stay open, so improvements come back to everyone using it.",
                  },
                  {
                    term: "Apache-2.0 engine",
                    desc: "@folio/engine is packaged separately under a permissive licence, with a patent grant, so other projects can build on the hard parts.",
                  },
                  {
                    term: "Transparent development",
                    desc: "The roadmap, the issues and the architecture notes are all public and in the repository.",
                  },
                  {
                    term: "Plugin runtime",
                    desc: "Commands can be added to the palette today; a versioned, sandboxed API is the next milestone.",
                  },
                ].map((item) => (
                  <div key={item.term}>
                    <dt className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck
                        className="size-4 stroke-[1.5] text-tertiary"
                        aria-hidden="true"
                      />
                      {item.term}
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-secondary">
                      {item.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-section">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-semibold">Roadmap</h2>
              <Link
                href="/roadmap"
                className="link-underline text-sm text-secondary transition-colors hover:text-primary"
              >
                Full roadmap
              </Link>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {roadmap.map((item) => (
                <li key={item.title} className="bg-surface p-card">
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase ${
                      item.phase === "Shipped" ? "text-success" : "text-tertiary"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {item.phase}
                  </span>
                  <h3 className="mt-3 font-medium">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Community */}
      <section id="community" className="scroll-mt-20 border-t border-border py-section">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold">Come build it</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-secondary">
              Folio is early. The most useful thing you can do right now is open a
              document that renders wrong and tell us about it — most rendering and
              signing bugs are specific to how one file was produced.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button href={`${site.repo}/issues/new/choose`} external>
                Report an issue
              </Button>
              <Button href={site.discussions} variant="secondary" external>
                Discussions
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
