import JSZip from "jszip";
import type { DocPage } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(rows: string[][]): string {
  const rowsXml = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (!value) return "";
          return `<c r="${colLetter(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

/** Hand-rolled minimal XLSX writer via JSZip (already a dependency) instead of a spreadsheet library. */
export async function writeXlsx(sheets: { name: string; rows: string[][] }[]): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("\n  ")}
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n    ")}
  </sheets>
</workbook>`
  );

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("\n  ")}
</Relationships>`
  );

  sheets.forEach((s, i) => {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows));
  });

  return zip.generateAsync({ type: "uint8array" });
}

type PositionedItem = { text: string; x: number; y: number; width: number; height: number };

/**
 * Clusters pdf.js text items into rows (by y-proximity) and columns (by x-proximity) — classical geometry heuristics, no ML.
 */
async function extractPageAsRows(doc: PdfDocumentProxy, sourcePageIndex: number): Promise<string[][]> {
  const page = await doc.getPage(sourcePageIndex + 1);
  const content = await page.getTextContent();

  const items: PositionedItem[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    items.push({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: Math.abs(item.height) || 10,
    });
  }
  if (items.length === 0) return [];

  const byY = [...items].sort((a, b) => b.y - a.y);
  const rows: PositionedItem[][] = [];
  let currentRow: PositionedItem[] = [];
  let rowAnchorY = byY[0].y;
  const rowTolerance = byY[0].height * 0.6;

  for (const item of byY) {
    if (Math.abs(item.y - rowAnchorY) > rowTolerance) {
      if (currentRow.length) rows.push(currentRow);
      currentRow = [];
      rowAnchorY = item.y;
    }
    currentRow.push(item);
  }
  if (currentRow.length) rows.push(currentRow);

  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const columnStarts: number[] = [];
  const xTolerance = 8;
  for (const x of xs) {
    if (columnStarts.length === 0 || x - columnStarts[columnStarts.length - 1] > xTolerance) {
      columnStarts.push(x);
    }
  }

  function columnIndexFor(x: number): number {
    let best = 0;
    let bestDist = Infinity;
    columnStarts.forEach((cx, i) => {
      const dist = Math.abs(cx - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  return rows.map((row) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const cells: string[] = new Array(columnStarts.length).fill("");
    for (const item of sorted) {
      const idx = columnIndexFor(item.x);
      cells[idx] = cells[idx] ? `${cells[idx]} ${item.text}` : item.text;
    }
    // Trim fully-empty trailing columns so sparse pages don't produce huge blank rows.
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    return cells;
  });
}

export async function exportAsXlsx(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>,
  fileNamePrefix: string
): Promise<Uint8Array> {
  const sheets: { name: string; rows: string[][] }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const doc = pdfjsDocs.get(p.sourceId);
    if (!doc) continue;
    const rows = await extractPageAsRows(doc, p.sourcePageIndex);
    if (rows.length === 0) continue;
    sheets.push({ name: `Page ${i + 1}`.slice(0, 31), rows });
  }
  if (sheets.length === 0) sheets.push({ name: (fileNamePrefix || "Sheet1").slice(0, 31), rows: [[""]] });
  return writeXlsx(sheets);
}
