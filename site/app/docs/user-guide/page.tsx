import type { Metadata } from "next";
import { Callout, Prose } from "@/components/prose";

export const metadata: Metadata = {
  title: "User guide",
  description:
    "Reading, annotating, editing, forms, signing, and organizing documents in Folio.",
  alternates: { canonical: "/docs/user-guide" },
};

export default function UserGuidePage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">User guide</h1>

      <Prose>
        <p>
          Folio is organized around a workspace rather than a single open file. Documents
          open in tabs, the library holds everything you have added, and the tools you see
          depend on what you are doing.
        </p>

        <h2>Opening documents</h2>
        <p>
          Open a document by dragging it onto the window, using <kbd>Ctrl</kbd>/
          <kbd>⌘</kbd>+<kbd>O</kbd>, or picking one from the library. Each document gets a
          tab, and tabs can be dragged apart into a split view for comparing two documents
          side by side.
        </p>
        <p>
          Adding a document to the library copies it into Folio&apos;s local storage so it
          can be indexed and searched. The original file on disk stays where it is and is
          never modified.
        </p>

        <h2>Reading</h2>
        <ul>
          <li>Scroll continuously, or switch to single-page mode</li>
          <li>
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>0</kbd> fits to width; <kbd>Ctrl</kbd>/
            <kbd>⌘</kbd>+<kbd>=</kbd> and <kbd>-</kbd> zoom
          </li>
          <li>
            Reading mode hides all chrome, including the app&apos;s outer toolbar, so only
            the page remains
          </li>
          <li>
            The left sidebar switches between thumbnails, the outline, bookmarks, layers
            and attachments
          </li>
        </ul>
        <p>
          Pages render as they approach the viewport and release their memory once they
          have scrolled well clear, so long documents stay responsive.
        </p>

        <h2>Annotating</h2>
        <p>
          Select text and the markup options appear — highlight, underline, strikeout,
          squiggly. The annotate toolbar adds freehand ink, shapes, arrows, sticky notes,
          text boxes, stamps and measurement tools.
        </p>
        <p>
          Every annotation appears in the comments panel, where they can be replied to and
          resolved. Typing <code>@</code> in a comment mentions someone; Folio remembers
          names you have used before.
        </p>

        <Callout title="Annotations stay editable">
          Annotations are kept separately from the page raster and are only flattened into
          the file when you export. Until then you can move, restyle or delete anything
          you have added.
        </Callout>

        <h2>Editing</h2>
        <p>
          The edit mode lets you change text in place, insert and replace images, and work
          on the page structure. Text editing covers the original glyphs with replacement
          text rather than reflowing the document, which means edits are precise and
          local — it is well suited to fixing a date or a name, and not to rewriting a
          paragraph.
        </p>
        <p>Page-level operations live in the organize view:</p>
        <ul>
          <li>Reorder pages by dragging, rotate, insert or delete</li>
          <li>Merge several documents, or split one into many</li>
          <li>Add watermarks, headers, footers and page numbers</li>
          <li>Compress, to reduce file size</li>
          <li>Compare two pages visually to see what changed</li>
        </ul>

        <h2>Forms</h2>
        <p>
          Existing AcroForm fields are fillable straight away — Folio highlights them and
          tabs between them in order. Form data can be exported and re-imported, which is
          useful for filling the same form repeatedly.
        </p>
        <p>
          You can also build forms: add text fields, checkboxes, radio groups and
          dropdowns, then attach calculation, validation and formatting rules. Those rules
          are written into the file as standard Acrobat actions, so they work in other
          readers too.
        </p>

        <Callout title="Folio does not execute PDF JavaScript">
          Form logic is written for other readers to run. Folio itself never evaluates
          JavaScript embedded in a document, which removes an entire category of
          document-borne attack.
        </Callout>

        <h2>Protecting and signing</h2>
        <p>
          The security centre covers encryption, permissions and inspection. Encrypt with
          a password using AES-128 or AES-256, and set permission flags for printing,
          copying and modification.
        </p>
        <p>
          <strong>Redaction removes content.</strong> Redacted text and images are deleted
          from the file rather than drawn over, so they cannot be recovered by selecting
          or extracting. Metadata scrubbing goes further, dropping the document
          information dictionary and XMP stream entirely and randomizing the document ID
          so files cannot be correlated.
        </p>
        <p>
          Signing requires a certificate. Folio produces a real cryptographic signature —
          a detached PKCS#7 structure written into the file using the standard byte-range
          technique — optionally with an RFC 3161 timestamp from a trusted authority.
          There is bulk signing for applying one certificate to many files, and signing
          plans for documents that need several people to sign in sequence.
        </p>

        <h2>OCR and conversion</h2>
        <p>
          Scanned pages have no text to select. Running OCR recognizes them, automatically
          correcting skew first, and the recognized text becomes searchable and
          selectable. Folio also OCRs scanned pages in the background after a document is
          opened, so search usually works before you think to ask for it.
        </p>
        <p>Documents export to DOCX, XLSX, PPTX, EPUB and SVG.</p>

        <h2>The library</h2>
        <p>
          Everything you add is searchable across your whole collection, not just the open
          document. Search runs against an index built in the background, so results are
          immediate rather than scanning files on each keystroke.
        </p>
        <p>Organize with tags, collections and favorites, and narrow with a query:</p>
        <pre>
          <code>{`tag:contract -tag:draft "signed copy"`}</code>
        </pre>
        <p>
          Terms are combined with AND, a leading <code>-</code> excludes, and quoted
          phrases stay together. Smart folders save a query as a live view; saved searches
          keep one around to re-run.
        </p>
        <p>
          Watched folders import documents automatically as they arrive — useful for a
          scanner output folder or a downloads directory.
        </p>

        <h2>Not losing work</h2>
        <ul>
          <li>
            <strong>Autosave</strong> snapshots in-progress edits periodically, and offers
            to restore them after a crash
          </li>
          <li>
            <strong>Version history</strong> keeps previous states of a document you can
            return to
          </li>
          <li>
            <strong>The audit log</strong> records document activity and signature events
          </li>
        </ul>

        <h2>Accessibility</h2>
        <p>
          Everything is reachable from the keyboard, and the accessibility panel shows a
          document&apos;s structure tags as a screen reader would encounter them. Font
          scaling, reduced motion and theme are in settings. Reduced motion also follows
          your system preference.
        </p>
      </Prose>
    </>
  );
}
