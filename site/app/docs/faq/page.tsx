import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about Folio — privacy, cost, compatibility and scope.",
  alternates: { canonical: "/docs/faq" },
};

const faqs = [
  {
    q: "Is Folio really free?",
    a: (
      <>
        <p>
          Yes. Folio is free software under the GPL-3.0 — free to use, read, modify and
          redistribute. There is no trial, no paid tier and no account.
        </p>
      </>
    ),
  },
  {
    q: "Do my documents get uploaded anywhere?",
    a: (
      <>
        <p>
          No. Every operation — rendering, editing, OCR, encryption, signing, conversion —
          runs on your own machine. Folio has no server component and collects no
          telemetry.
        </p>
        <p>
          The one exception is explicit and opt-in: if you request an RFC 3161 trusted
          timestamp when signing, Folio contacts the timestamp authority you named. It
          sends a hash of the signature, never the document.
        </p>
      </>
    ),
  },
  {
    q: "Where are my documents stored?",
    a: (
      <>
        <p>
          Documents you add to the library are copied into Folio&apos;s local application
          storage, along with the search index, version history and autosave snapshots.
          Your original files stay where they are and are never modified.
        </p>
        <p>
          This data is per-machine and does not sync. Uninstalling Folio removes it.
        </p>
      </>
    ),
  },
  {
    q: "Can Folio replace Adobe Acrobat?",
    a: (
      <>
        <p>
          For most day-to-day work — reading, annotating, filling forms, editing pages,
          redacting, signing, converting — yes. Folio covers those properly.
        </p>
        <p>
          It does not aim at complete parity. Prepress and colour-managed print
          production, PDF/A archival conformance, and full tagged-PDF authoring are not
          there yet; the first two are on the roadmap. If your work depends on those, keep
          Acrobat around.
        </p>
      </>
    ),
  },
  {
    q: "Are the signatures Folio produces real?",
    a: (
      <>
        <p>
          Yes. Folio produces a genuine cryptographic signature using the standard
          incremental byte-range technique from ISO 32000-1 §12.8 — a detached PKCS#7/CMS
          structure over a hash of the document, verifiable in Acrobat and any other
          compliant reader. RFC 3161 timestamps are supported.
        </p>
        <p>You need your own certificate; Folio does not issue them.</p>
      </>
    ),
  },
  {
    q: "Is redaction actually safe?",
    a: (
      <>
        <p>
          Redaction removes the underlying content rather than drawing a black box over
          it, so redacted text cannot be selected, copied or extracted from the exported
          file. Metadata scrubbing separately drops the document information dictionary
          and XMP stream and randomizes the document ID.
        </p>
        <p>
          As with any tool, verify before distributing something sensitive. If you find a
          case where content survives redaction, please{" "}
          <a
            href={`${site.repo}/security/advisories/new`}
            target="_blank"
            rel="noreferrer"
          >
            report it privately
          </a>
          .
        </p>
      </>
    ),
  },
  {
    q: "Does Folio run PDF JavaScript?",
    a: (
      <>
        <p>
          No, never. When you build a form with calculation or validation rules, Folio
          writes them as standard Acrobat actions so other readers execute them — but
          Folio itself does not evaluate script embedded in a document.
        </p>
      </>
    ),
  },
  {
    q: "Why is the app unsigned?",
    a: (
      <>
        <p>
          Code signing certificates cost money every year, and Folio is a pre-1.0 project
          that has not taken that on. Signing and notarization are on the roadmap. Until
          then you can build from source if you would rather not run an unsigned binary.
        </p>
      </>
    ),
  },
  {
    q: "Is there a web version?",
    a: (
      <>
        <p>
          The interface runs in a browser during development, but there is no hosted
          version. Folio is designed to keep documents on your machine, and hosting it
          would undercut that.
        </p>
      </>
    ),
  },
  {
    q: "Can I use the PDF engine in my own project?",
    a: (
      <>
        <p>
          Yes. <code>@folio/engine</code> is the rendering, editing, OCR, signing and
          conversion logic packaged on its own, with no DOM, React or Electron
          dependency. It is licensed under Apache-2.0 — deliberately more permissive than
          the application — so it can be embedded regardless of your project&apos;s
          license.
        </p>
      </>
    ),
  },
  {
    q: "How can I help?",
    a: (
      <>
        <p>
          Report bugs with a sample document, since most rendering and signing issues are
          file-specific. Beyond that, the{" "}
          <a
            href={`${site.repo}/blob/main/CONTRIBUTING.md`}
            target="_blank"
            rel="noreferrer"
          >
            contributing guide
          </a>{" "}
          covers the development setup, and issues labelled{" "}
          <code>good first issue</code> are a reasonable starting point.
        </p>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">FAQ</h1>

      <div className="mt-10 space-y-10">
        {faqs.map((faq) => (
          <section key={faq.q}>
            <h2 className="text-lg font-semibold tracking-tight">{faq.q}</h2>
            <Prose>{faq.a}</Prose>
          </section>
        ))}
      </div>
    </>
  );
}
