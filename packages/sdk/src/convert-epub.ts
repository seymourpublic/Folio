import JSZip from "jszip";
import { createId } from "./document-model";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageXhtml(title: string, paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>${body || "<p></p>"}</body>
</html>`;
}

/** Packages per-page text into a valid EPUB3. */
export async function toEpub(pagesParagraphs: string[][], title: string, author?: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const bookId = `urn:uuid:${createId()}`;

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    "OEBPS/styles.css",
    "body{font-family:serif;line-height:1.6;margin:1.5em;}p{margin:0 0 1em;}"
  );

  const pageFiles = pagesParagraphs.map((_, i) => `page-${i + 1}.xhtml`);
  pagesParagraphs.forEach((paragraphs, i) => {
    zip.file(`OEBPS/${pageFiles[i]}`, pageXhtml(`${title} — Page ${i + 1}`, paragraphs));
  });

  const manifestItems = pageFiles
    .map((f, i) => `<item id="page${i + 1}" href="${f}" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spineItems = pageFiles.map((_, i) => `<itemref idref="page${i + 1}"/>`).join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
    ${author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : ""}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
  );

  const navItems = pageFiles.map((f, i) => `<li><a href="${f}">Page ${i + 1}</a></li>`).join("\n        ");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(title)}</h1>
    <ol>
        ${navItems}
    </ol>
  </nav>
</body>
</html>`
  );

  return zip.generateAsync({ type: "uint8array" });
}
