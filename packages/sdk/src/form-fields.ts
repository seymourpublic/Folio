import type { PdfPageProxy } from "./pdfjs";

export type FormFieldOption = { exportValue: string; displayValue: string };

export type FormFieldDef = {
  id: string;
  fieldName: string;
  kind: "text" | "checkbox" | "radio" | "select" | "signature" | "unsupported";
  x: number;
  y: number;
  width: number;
  height: number;
  multiLine: boolean;
  readOnly: boolean;
  initialValue: string;
  exportValue?: string;
  buttonValue?: string;
  options?: FormFieldOption[];
};

export async function getFormFieldsForPage(
  page: PdfPageProxy,
  viewport1: { convertToViewportPoint: (x: number, y: number) => number[] }
): Promise<FormFieldDef[]> {
  const annotations = await page.getAnnotations({ intent: "display" });
  const fields: FormFieldDef[] = [];

  for (const a of annotations) {
    if (a.subtype !== "Widget" || !a.fieldName) continue;

    const [rx1, ry1] = viewport1.convertToViewportPoint(a.rect[0], a.rect[1]);
    const [rx2, ry2] = viewport1.convertToViewportPoint(a.rect[2], a.rect[3]);
    const x = Math.min(rx1, rx2);
    const y = Math.min(ry1, ry2);
    const width = Math.abs(rx2 - rx1);
    const height = Math.abs(ry2 - ry1);

    let kind: FormFieldDef["kind"] = "unsupported";
    if (a.fieldType === "Tx") kind = "text";
    else if (a.fieldType === "Btn" && a.radioButton) kind = "radio";
    else if (a.fieldType === "Btn" && a.checkBox) kind = "checkbox";
    else if (a.fieldType === "Ch") kind = "select";
    else if (a.fieldType === "Sig") kind = "signature";

    fields.push({
      id: a.id ?? `${a.fieldName}-${x}-${y}`,
      fieldName: a.fieldName,
      kind,
      x,
      y,
      width,
      height,
      multiLine: Boolean(a.multiLine),
      readOnly: Boolean(a.readOnly),
      initialValue: typeof a.fieldValue === "string" ? a.fieldValue : "",
      exportValue: a.exportValue,
      buttonValue: a.buttonValue,
      options: a.options,
    });
  }

  return fields;
}
