import type { DocPage } from "./document-model";
import type { PdfDocumentProxy } from "./pdfjs";
import { getFormFieldsForPage, type FormFieldDef } from "./form-fields";

export type CollectedField = { page: DocPage; field: FormFieldDef };

/** Walks every page's real AcroForm widgets (the fields a loaded PDF already has) via pdf.js. */
export async function collectAllFormFields(
  pages: DocPage[],
  pdfjsDocs: Map<string, PdfDocumentProxy>
): Promise<CollectedField[]> {
  const results: CollectedField[] = [];
  for (const docPage of pages) {
    const doc = pdfjsDocs.get(docPage.sourceId);
    if (!doc) continue;
    const page = await doc.getPage(docPage.sourcePageIndex + 1);
    const totalRotation = (((page.rotate + docPage.rotation) % 360) + 360) % 360;
    const viewport1 = page.getViewport({ scale: 1, rotation: totalRotation });
    const fields = await getFormFieldsForPage(page, viewport1);
    for (const field of fields) results.push({ page: docPage, field });
  }
  return results;
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function exportFormDataJson(values: Record<string, string>): string {
  return JSON.stringify(values, null, 2);
}

export function exportFormDataFdf(values: Record<string, string>): string {
  const fields = Object.entries(values)
    .map(([name, value]) => `<< /T (${escapePdfText(name)}) /V (${escapePdfText(value)}) >>`)
    .join("\n");
  return [
    "%FDF-1.2",
    "1 0 obj",
    "<< /FDF << /Fields [",
    fields,
    "] >> >>",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF",
  ].join("\n");
}

export function exportFormDataXfdf(values: Record<string, string>): string {
  const fields = Object.entries(values)
    .map(([name, value]) => `    <field name="${escapeXml(name)}"><value>${escapeXml(value)}</value></field>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">',
    "  <fields>",
    fields,
    "  </fields>",
    "</xfdf>",
  ].join("\n");
}

export function parseFormData(text: string, hintFileName?: string): Record<string, string> {
  const trimmed = text.trim();
  const looksXml = trimmed.startsWith("<?xml") || trimmed.startsWith("<xfdf") || hintFileName?.endsWith(".xfdf");
  const looksFdf = trimmed.startsWith("%FDF") || hintFileName?.endsWith(".fdf");

  if (looksXml) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const values: Record<string, string> = {};
    for (const field of Array.from(doc.getElementsByTagName("field"))) {
      const name = field.getAttribute("name");
      const value = field.getElementsByTagName("value")[0]?.textContent ?? "";
      if (name) values[name] = value;
    }
    return values;
  }

  if (looksFdf) {
    const values: Record<string, string> = {};
    const blockRegex = /\/T\s*\(([^)]*)\)\s*\/V\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(text))) {
      values[match[1].replace(/\\([()\\])/g, "$1")] = match[2].replace(/\\([()\\])/g, "$1");
    }
    return values;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export type AutoFillProfile = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

const FIELD_NAME_MATCHERS: { pattern: RegExp; profileKey: keyof AutoFillProfile }[] = [
  { pattern: /e[-_]?mail/i, profileKey: "email" },
  { pattern: /(full[-_ ]?name|^name$|your[-_ ]?name)/i, profileKey: "fullName" },
  { pattern: /phone|mobile|tel/i, profileKey: "phone" },
  { pattern: /zip|postal/i, profileKey: "zip" },
  { pattern: /city|town/i, profileKey: "city" },
  { pattern: /state|province/i, profileKey: "state" },
  { pattern: /address|street/i, profileKey: "address" },
  { pattern: /name/i, profileKey: "fullName" },
];

/** Best-effort field-name → profile-field matching, since PDF form field names are arbitrary
 * strings with no standard vocabulary. Storage/persistence of the AutoFillProfile itself is a
 * host-app concern (Folio backs it with localStorage) — bring your own profile object. */
export function matchProfileField(fieldName: string, profile: AutoFillProfile): string | null {
  for (const { pattern, profileKey } of FIELD_NAME_MATCHERS) {
    if (pattern.test(fieldName)) {
      const value = profile[profileKey];
      if (value) return value;
    }
  }
  return null;
}
