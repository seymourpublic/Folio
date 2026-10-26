"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  FormFieldCalculation,
  FormFieldConditional,
  FormFieldCreateAnnotation,
} from "@folio/engine";

type FormFieldPropertiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotation: FormFieldCreateAnnotation | null;
  onUpdate: (patch: Partial<FormFieldCreateAnnotation>) => void;
  otherFieldNames: string[];
};

const CALC_OPS: FormFieldCalculation["op"][] = ["SUM", "PRODUCT", "AVERAGE", "MIN", "MAX"];

export function FormFieldPropertiesDialog({
  open,
  onOpenChange,
  annotation,
  onUpdate,
  otherFieldNames,
}: FormFieldPropertiesDialogProps) {
  const [optionsText, setOptionsText] = useState(() => annotation?.options?.join("\n") ?? "");

  if (!annotation) return null;
  const a = annotation;

  function toggleCalcField(field: string) {
    const current = a.calculation?.sourceFields ?? [];
    const next = current.includes(field) ? current.filter((f) => f !== field) : [...current, field];
    onUpdate({ calculation: next.length ? { op: a.calculation?.op ?? "SUM", sourceFields: next } : undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Field properties — {a.fieldName}</DialogTitle>
          <DialogDescription>
            Calculation, validation, and conditional logic are embedded as standard Acrobat
            JavaScript actions — they run in the PDF reader that opens the file, not in this app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={Boolean(a.required)}
              onCheckedChange={(c) => onUpdate({ required: Boolean(c) })}
            />
            <Label htmlFor="required" className="text-sm font-normal">
              Required field
            </Label>
          </div>

          {a.fieldKind === "dropdown" && (
            <div className="space-y-1.5">
              <Label>Options (one per line)</Label>
              <textarea
                className="h-24 w-full rounded border p-2 text-sm"
                value={optionsText}
                onChange={(e) => {
                  setOptionsText(e.target.value);
                  onUpdate({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) });
                }}
              />
            </div>
          )}

          {(a.fieldKind === "text" || a.fieldKind === "date") && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs uppercase">Validation range (numeric fields)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={a.validateMin ?? ""}
                  onChange={(e) => onUpdate({ validateMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={a.validateMax ?? ""}
                  onChange={(e) => onUpdate({ validateMax: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {(a.fieldKind === "text" || a.fieldKind === "date") && otherFieldNames.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs uppercase">Calculated value</Label>
              <select
                className="h-8 w-full rounded border bg-background px-2 text-sm"
                value={a.calculation?.op ?? ""}
                onChange={(e) =>
                  onUpdate({
                    calculation: e.target.value
                      ? { op: e.target.value as FormFieldCalculation["op"], sourceFields: a.calculation?.sourceFields ?? [] }
                      : undefined,
                  })
                }
              >
                <option value="">None</option>
                {CALC_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              {a.calculation && (
                <div className="flex flex-wrap gap-2">
                  {otherFieldNames.map((f) => (
                    <label key={f} className="flex items-center gap-1 text-xs">
                      <Checkbox
                        checked={a.calculation?.sourceFields.includes(f) ?? false}
                        onCheckedChange={() => toggleCalcField(f)}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {otherFieldNames.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs uppercase">Conditional visibility</Label>
              <div className="flex items-center gap-2 text-sm">
                <span>When</span>
                <select
                  className="h-8 rounded border bg-background px-2 text-sm"
                  value={a.conditional?.triggerField ?? ""}
                  onChange={(e) => {
                    const triggerField = e.target.value;
                    if (!triggerField) {
                      onUpdate({ conditional: undefined });
                      return;
                    }
                    const next: FormFieldConditional = {
                      triggerField,
                      equalsValue: a.conditional?.equalsValue ?? "",
                      action: a.conditional?.action ?? "show",
                    };
                    onUpdate({ conditional: next });
                  }}
                >
                  <option value="">(none)</option>
                  {otherFieldNames.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <span>equals</span>
                <Input
                  className="h-8 w-24"
                  value={a.conditional?.equalsValue ?? ""}
                  disabled={!a.conditional}
                  onChange={(e) => onUpdate({ conditional: a.conditional && { ...a.conditional, equalsValue: e.target.value } })}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Then</span>
                <select
                  className="h-8 rounded border bg-background px-2 text-sm"
                  value={a.conditional?.action ?? "show"}
                  disabled={!a.conditional}
                  onChange={(e) =>
                    onUpdate({ conditional: a.conditional && { ...a.conditional, action: e.target.value as "show" | "hide" } })
                  }
                >
                  <option value="show">show this field</option>
                  <option value="hide">hide this field</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
