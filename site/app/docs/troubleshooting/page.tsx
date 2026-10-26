import type { Metadata } from "next";
import { Callout, Prose } from "@/components/prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Troubleshooting",
  description: "Fixes for common problems opening, signing and exporting documents.",
  alternates: { canonical: "/docs/troubleshooting" },
};

export default function TroubleshootingPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Troubleshooting</h1>

      <Prose>
        <p>
          If none of this helps,{" "}
          <a href={`${site.repo}/issues/new/choose`} target="_blank" rel="noreferrer">
            open an issue
          </a>
          . Attaching the document involved makes a bug roughly ten times easier to fix,
          since most of these problems are specific to how a particular file was produced.
        </p>

        <h2>The app will not start</h2>
        <p>
          <strong>Windows.</strong> SmartScreen blocks unsigned installers by default.
          Choose <strong>More info → Run anyway</strong>.
        </p>

        <h2>A document will not open</h2>
        <p>
          <strong>It asks for a password you do not have.</strong> The document is
          encrypted. Folio cannot open it without the password, and there is no recovery
          path — that is the point of encryption.
        </p>
        <p>
          <strong>It opens but pages are blank.</strong> Usually a document using an
          encryption revision Folio cannot fully decrypt for editing. Viewing normally
          still works because that path decrypts independently. If pages are genuinely
          empty, please report it with the file.
        </p>
        <p>
          <strong>It fails outright.</strong> Some files are structurally damaged and
          other readers repair them silently. Try opening and re-saving in another
          application first. Either way, a report with the file is useful — being tolerant
          of broken PDFs is part of the job.
        </p>

        <h2>Text cannot be selected or searched</h2>
        <p>
          The page is an image — a scan or a photo — with no text layer. Run OCR on the
          document and the recognized text becomes selectable and searchable.
        </p>
        <p>
          Folio also OCRs scanned pages in the background after opening, one page at a
          time. On a long scanned document that takes a while; search coverage improves as
          it progresses.
        </p>

        <h2>OCR results are poor</h2>
        <ul>
          <li>
            Low-resolution scans are the usual cause. Below roughly 200 DPI, accuracy
            drops sharply and there is not much any engine can do.
          </li>
          <li>
            Heavy skew beyond what automatic deskew corrects, very low contrast, or
            handwriting will all read badly.
          </li>
          <li>
            Check that the document&apos;s language matches what OCR is set to recognize.
          </li>
        </ul>

        <h2>Search is not finding something</h2>
        <p>
          Library search relies on a background index. A document added moments ago may
          not be indexed yet — indexing runs one document at a time, deliberately yielding
          so it never competes with what you are doing.
        </p>
        <p>
          Also check your query syntax. Terms are combined with AND, so{" "}
          <code>tag:invoice tag:paid</code> requires both. Use quotes for an exact phrase,
          and a leading <code>-</code> to exclude.
        </p>

        <h2>Signing fails</h2>
        <p>
          <strong>The certificate is rejected.</strong> Folio needs a certificate with an
          accessible private key, normally a PKCS#12 (<code>.p12</code> or{" "}
          <code>.pfx</code>) file. A certificate alone, without its key, cannot sign.
        </p>
        <p>
          <strong>Timestamping fails.</strong> The TSA URL may be wrong, the server may be
          down, or you may be offline. Timestamps are optional — signing without one still
          produces a valid signature, just without independent proof of when it happened.
        </p>
        <Callout title="Timestamps need the desktop app">
          Timestamp authorities generally do not send CORS headers, so the desktop shell
          proxies the request. In browser-only development mode, timestamping will not
          work.
        </Callout>
        <p>
          <strong>The signature shows as invalid afterwards.</strong> Something modified
          the file after signing. A signature covers the exact bytes present when it was
          applied, so any later edit — including re-saving through another tool —
          invalidates it. Sign last.
        </p>

        <h2>Export produces the wrong layout</h2>
        <p>
          Converting to DOCX reconstructs paragraphs from text positions, since a PDF has
          no paragraph structure to read. It handles prose-heavy pages well. Multi-column
          layouts and tables will come out in the wrong order; the spreadsheet exporter
          uses geometric clustering and does better on tabular pages.
        </p>
        <p>
          <strong>Text in another script comes out wrong.</strong> Hebrew and other
          non-cursive right-to-left scripts export correctly. Arabic currently uses
          isolated letterforms because contextual shaping is not implemented — it is on
          the roadmap.
        </p>

        <h2>Performance problems</h2>
        <p>
          <strong>Scrolling stutters.</strong> Usually a page with very large embedded
          images. Check whether background OCR or indexing is running, which is temporary.
        </p>
        <p>
          <strong>Memory keeps climbing.</strong> It should not — off-screen pages release
          their bitmaps as they scroll clear. If usage grows steadily on a long document,
          that is a bug worth reporting with the page count and the file.
        </p>

        <h2>Getting diagnostic information</h2>
        <p>
          Open the developer tools from the View menu and check the console. Errors there
          are the single most useful thing to include in a bug report, along with your
          OS, your Folio version, and whether you are on a downloaded build or a source
          build.
        </p>
      </Prose>
    </>
  );
}
