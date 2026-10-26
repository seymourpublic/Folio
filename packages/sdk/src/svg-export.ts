import type { Annotation, DocPage } from "./document-model";
import { distanceInPoints, formatDistance } from "./measurement";
import { stampPreset } from "./stamps";
import type { PdfDocumentProxy } from "./pdfjs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function renderPageToPngDataUrl(
  doc: PdfDocumentProxy,
  sourcePageIndex: number,
  rotationDelta: number,
  scale = 2
): Promise<{ dataUrl: string; widthPts: number; heightPts: number }> {
  const page = await doc.getPage(sourcePageIndex + 1);
  const totalRotation = (((page.rotate + rotationDelta) % 360) + 360) % 360;
  const viewport1 = page.getViewport({ scale: 1, rotation: totalRotation });
  const renderViewport = page.getViewport({ scale, rotation: totalRotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;

  return { dataUrl: canvas.toDataURL("image/png"), widthPts: viewport1.width, heightPts: viewport1.height };
}

function arrowHeadSvgPoints(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  const p1 = { x: x2 + size * Math.cos(a1), y: y2 + size * Math.sin(a1) };
  const p2 = { x: x2 + size * Math.cos(a2), y: y2 + size * Math.sin(a2) };
  return `${x2},${y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

function annotationToSvg(a: Annotation): string {
  switch (a.type) {
    case "highlight":
      return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="${a.color}" fill-opacity="0.4" />`;
    case "underline":
      return `<line x1="${a.x}" y1="${a.y + a.height}" x2="${a.x + a.width}" y2="${a.y + a.height}" stroke="${a.color}" stroke-width="2" />`;
    case "strikeout":
      return `<line x1="${a.x}" y1="${a.y + a.height / 2}" x2="${a.x + a.width}" y2="${a.y + a.height / 2}" stroke="${a.color}" stroke-width="2" />`;
    case "squiggly": {
      let d = "";
      const steps = Math.max(2, Math.ceil(a.width / 8));
      for (let i = 0; i <= steps; i++) {
        const x = a.x + i * 8;
        const y = a.y + a.height - (i % 2 === 0 ? 0 : 5);
        d += `${i === 0 ? "M" : "L"}${x},${y} `;
      }
      return `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="2" />`;
    }
    case "ink":
      return `<polyline points="${a.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
    case "rect":
      return a.filled
        ? `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="${a.color}" />`
        : `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth ?? 2}" />`;
    case "ellipse": {
      const cx = a.x + a.width / 2;
      const cy = a.y + a.height / 2;
      return a.filled
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${a.width / 2}" ry="${a.height / 2}" fill="${a.color}" />`
        : `<ellipse cx="${cx}" cy="${cy}" rx="${a.width / 2}" ry="${a.height / 2}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth ?? 2}" />`;
    }
    case "line":
      return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linecap="round" />`;
    case "arrow":
      return (
        `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linecap="round" />` +
        `<polygon points="${arrowHeadSvgPoints(a.x1, a.y1, a.x2, a.y2, 10)}" fill="${a.color}" />`
      );
    case "measurement": {
      const label = formatDistance(distanceInPoints(a.x1, a.y1, a.x2, a.y2), a.unit);
      const mx = (a.x1 + a.x2) / 2;
      const my = (a.y1 + a.y2) / 2;
      return (
        `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="1.5" />` +
        `<text x="${mx}" y="${my}" font-size="10" fill="${a.color}" text-anchor="middle">${esc(label)}</text>`
      );
    }
    case "text": {
      const weight = a.bold ? "bold" : "normal";
      const style = a.italic ? "italic" : "normal";
      return `<text x="${a.x}" y="${a.y + a.fontSize}" font-size="${a.fontSize}" font-weight="${weight}" font-style="${style}" fill="${a.color}" text-decoration="${a.underline ? "underline" : "none"}">${esc(a.text)}</text>`;
    }
    case "callout": {
      const boxCx = a.x + a.width / 2;
      const boxCy = a.y + a.height / 2;
      return (
        `<line x1="${a.pointerX}" y1="${a.pointerY}" x2="${boxCx}" y2="${boxCy}" stroke="${a.color}" stroke-width="1.5" />` +
        `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="white" stroke="${a.color}" />` +
        `<text x="${a.x + 4}" y="${a.y + a.fontSize + 4}" font-size="${a.fontSize}" fill="${a.color}">${esc(a.text)}</text>`
      );
    }
    case "note":
      return (
        `<rect x="${a.x}" y="${a.y}" width="180" height="70" fill="#fde68a" stroke="#d97706" />` +
        `<text x="${a.x + 6}" y="${a.y + 18}" font-size="9" fill="#333333">${esc(a.text.slice(0, 60))}</text>`
      );
    case "image":
      return `<image href="${a.dataUrl}" x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" opacity="${a.opacity ?? 1}" ${a.rotation ? `transform="rotate(${a.rotation} ${a.x + a.width / 2} ${a.y + a.height / 2})"` : ""} />`;
    case "stamp": {
      if (a.dataUrl) return `<image href="${a.dataUrl}" x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" />`;
      const preset = stampPreset(a.presetId);
      const color = a.color ?? preset?.color ?? "#dc2626";
      return (
        `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="none" stroke="${color}" stroke-width="4" transform="rotate(-6 ${a.x + a.width / 2} ${a.y + a.height / 2})" />` +
        `<text x="${a.x + a.width / 2}" y="${a.y + a.height / 2}" font-size="16" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-6 ${a.x + a.width / 2} ${a.y + a.height / 2})">${esc(a.label ?? preset?.label ?? "STAMP")}</text>`
      );
    }
    case "redact":
      return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="black" />`;
    case "text-edit":
      return (
        `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="white" />` +
        `<text x="${a.x}" y="${a.y + a.fontSize}" font-size="${a.fontSize}" fill="${a.color}">${esc(a.newText)}</text>`
      );
    case "link":
    case "form-field":
    case "form-field-create":
      return "";
  }
}

export async function exportPageAsSvg(doc: PdfDocumentProxy, docPage: DocPage): Promise<string> {
  const { dataUrl, widthPts, heightPts } = await renderPageToPngDataUrl(doc, docPage.sourcePageIndex, docPage.rotation);
  const body = docPage.annotations.map(annotationToSvg).join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthPts}" height="${heightPts}" viewBox="0 0 ${widthPts} ${heightPts}">`,
    `  <image href="${dataUrl}" x="0" y="0" width="${widthPts}" height="${heightPts}" />`,
    `  ${body}`,
    `</svg>`,
  ].join("\n");
}
