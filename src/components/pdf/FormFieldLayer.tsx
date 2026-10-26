"use client";

import { useEffect, useRef, useState } from "react";
import { getFormFieldsForPage, type PdfDocumentProxy, type FormFieldDef, type Annotation } from "@folio/engine";
import { Checkbox } from "@/components/ui/checkbox";
import { PenLine } from "lucide-react";

type FormFieldLayerProps = {
  doc: PdfDocumentProxy;
  sourcePageIndex: number;
  rotation: number;
  scale: number;
  annotations: Annotation[];
  onFieldChange: (field: FormFieldDef, value: string) => void;
  onSignatureFieldClick?: (field: FormFieldDef) => void;
};

export function FormFieldLayer({
  doc,
  sourcePageIndex,
  rotation,
  scale,
  annotations,
  onFieldChange,
  onSignatureFieldClick,
}: FormFieldLayerProps) {
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const seededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    seededRef.current = false;

    (async () => {
      const page = await doc.getPage(sourcePageIndex + 1);
      if (cancelled) return;
      const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360;
      const viewport1 = page.getViewport({ scale: 1, rotation: totalRotation });
      const detected = await getFormFieldsForPage(page, viewport1);
      if (!cancelled) setFields(detected);
    })().catch((err) => console.error("Failed to read form fields", err));

    return () => {
      cancelled = true;
    };
  }, [doc, sourcePageIndex, rotation]);

  useEffect(() => {
    if (seededRef.current || fields.length === 0) return;
    seededRef.current = true;
    for (const field of fields) {
      if (field.kind !== "text" && field.kind !== "select") continue;
      const hasValue = annotations.some((a) => a.type === "form-field" && a.fieldName === field.fieldName);
      if (!hasValue && field.initialValue) onFieldChange(field, field.initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function currentValue(field: FormFieldDef): string {
    if (field.kind === "radio") {
      const selected = annotations.find(
        (a) => a.type === "form-field" && a.fieldName === field.fieldName && a.value === field.buttonValue
      );
      return selected ? (field.buttonValue ?? "") : "";
    }

    const ann = annotations.find((a) => a.type === "form-field" && a.fieldName === field.fieldName);
    if (ann && ann.type === "form-field") return ann.value;

    if (field.kind === "checkbox") {
      return field.initialValue && field.initialValue === field.exportValue ? field.initialValue : "";
    }
    return field.initialValue;
  }

  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: field.x * scale,
          top: field.y * scale,
          width: field.width * scale,
          height: field.height * scale,
          pointerEvents: field.readOnly ? "none" : "auto",
        };
        const value = currentValue(field);

        if (field.kind === "text") {
          return field.multiLine ? (
            <textarea
              key={field.id}
              style={style}
              defaultValue={value}
              className="resize-none border border-blue-400 bg-blue-50/70 px-1 text-sm outline-none focus:bg-white"
              onBlur={(e) => onFieldChange(field, e.target.value)}
            />
          ) : (
            <input
              key={field.id}
              type="text"
              style={style}
              defaultValue={value}
              className="border border-blue-400 bg-blue-50/70 px-1 text-sm outline-none focus:bg-white"
              onBlur={(e) => onFieldChange(field, e.target.value)}
            />
          );
        }

        if (field.kind === "checkbox") {
          return (
            <div key={field.id} style={style} className="flex items-center justify-center">
              <Checkbox
                checked={Boolean(value)}
                onCheckedChange={(checked) => onFieldChange(field, checked ? field.exportValue ?? "on" : "")}
                className="h-full w-full rounded-none border-blue-400"
              />
            </div>
          );
        }

        if (field.kind === "radio") {
          const isChecked = value === field.buttonValue;
          return (
            <button
              key={field.id}
              style={style}
              onClick={() => onFieldChange(field, isChecked ? "" : (field.buttonValue ?? ""))}
              className="flex items-center justify-center rounded-full border border-blue-400 bg-blue-50/70"
            >
              {isChecked && <div className="h-1/2 w-1/2 rounded-full bg-blue-600" />}
            </button>
          );
        }

        if (field.kind === "select") {
          return (
            <select
              key={field.id}
              style={style}
              defaultValue={value}
              className="border border-blue-400 bg-blue-50/70 text-sm outline-none focus:bg-white"
              onChange={(e) => onFieldChange(field, e.target.value)}
            >
              {!value && <option value="" />}
              {field.options?.map((opt) => (
                <option key={opt.exportValue} value={opt.exportValue}>
                  {opt.displayValue}
                </option>
              ))}
            </select>
          );
        }

        if (field.kind === "signature") {
          return (
            <button
              key={field.id}
              type="button"
              style={style}
              onClick={() => onSignatureFieldClick?.(field)}
              className="flex items-center justify-center gap-1 border-2 border-dashed border-blue-400 bg-blue-400/10 text-[11px] font-medium text-blue-600 hover:bg-blue-400/20"
            >
              <PenLine className="h-3.5 w-3.5" />
              Click to sign
            </button>
          );
        }

        return null;
      })}
    </>
  );
}
