import { PDFBool, PDFDict, PDFName, PDFString, type PDFDocument, type PDFRadioGroup, type PDFTextField } from "pdf-lib";
import type { DocPage, FormFieldCalculation, FormFieldConditional } from "./document-model";

function actionDict(context: PDFDocument["context"], js: string): PDFDict {
  const dict = PDFDict.withContext(context);
  dict.set(PDFName.of("S"), PDFName.of("JavaScript"));
  dict.set(PDFName.of("JS"), PDFString.of(js));
  return dict;
}

function setFieldAction(field: PDFTextField, context: PDFDocument["context"], key: "F" | "K" | "V" | "C", js: string) {
  const dict = field.acroField.dict;
  const existing = dict.get(PDFName.of("AA"));
  const aaDict = existing instanceof PDFDict ? existing : PDFDict.withContext(context);
  if (!(existing instanceof PDFDict)) dict.set(PDFName.of("AA"), aaDict);
  aaDict.set(PDFName.of(key), actionDict(context, js));
}

function calculationJs(calc: FormFieldCalculation): string {
  const fields = calc.sourceFields.map((f) => `"${f.replace(/"/g, "")}"`).join(", ");
  return `AFSimple_Calculate("${calc.op}", new Array(${fields}));`;
}

/** Runs on the *trigger* field's Validate action (fires once its new value is committed) and
 * toggles the target field's visibility — the standard cross-field-reactivity pattern for
 * AcroForm JS, since there's no native "on other field changed" event. */
function conditionalJs(targetFieldName: string, cond: FormFieldConditional): string {
  const shown = cond.action === "show" ? "display.visible" : "display.hidden";
  const hidden = cond.action === "show" ? "display.hidden" : "display.visible";
  const safeTarget = targetFieldName.replace(/"/g, "");
  const safeValue = cond.equalsValue.replace(/"/g, "");
  return (
    `if (event.value == "${safeValue}") { this.getField("${safeTarget}").display = ${shown}; } ` +
    `else { this.getField("${safeTarget}").display = ${hidden}; }`
  );
}

/**
 * Materializes `form-field-create` annotations into real, fillable AcroForm fields.
 * Calculation, validation and format logic is emitted as standard Acrobat core-JS actions
 * (AFSimple_Calculate, AFRange_Validate, AFDate_FormatEx); this app never runs PDF JavaScript.
 */
export function applyFormFieldCreations(output: PDFDocument, pages: DocPage[]): void {
  const form = output.getForm();
  const context = output.context;
  const acroFormDict = form.acroForm.dict;
  acroFormDict.set(PDFName.of("NeedAppearances"), PDFBool.True);

  const radioGroups = new Map<string, PDFRadioGroup>();
  const textFieldsByName = new Map<string, PDFTextField>();
  const pendingConditionals: { triggerFieldName: string; targetFieldName: string; conditional: FormFieldConditional }[] = [];
  const calcOrderRefs: unknown[] = [];

  pages.forEach((docPage, pageIndex) => {
    const page = output.getPage(pageIndex);
    const { height } = page.getSize();
    const flipY = (y: number) => height - y;

    for (const ann of docPage.annotations) {
      if (ann.type !== "form-field-create") continue;
      const rect = { x: ann.x, y: flipY(ann.y + ann.height), width: ann.width, height: ann.height };

      if (ann.fieldKind === "text" || ann.fieldKind === "date") {
        let tf = textFieldsByName.get(ann.fieldName);
        if (!tf) {
          tf = form.createTextField(ann.fieldName);
          textFieldsByName.set(ann.fieldName, tf);
        }
        tf.addToPage(page, rect);
        if (ann.defaultValue) tf.setText(ann.defaultValue);

        if (ann.fieldKind === "date") {
          setFieldAction(tf, context, "F", 'AFDate_FormatEx("mm/dd/yyyy");');
          setFieldAction(tf, context, "K", 'AFDate_KeystrokeEx("mm/dd/yyyy");');
        }
        if (ann.validateMin != null || ann.validateMax != null) {
          const hasMin = ann.validateMin != null;
          const hasMax = ann.validateMax != null;
          setFieldAction(
            tf,
            context,
            "V",
            `AFRange_Validate(${hasMin}, ${ann.validateMin ?? 0}, ${hasMax}, ${ann.validateMax ?? 0});`
          );
        }
        if (ann.calculation) {
          setFieldAction(tf, context, "C", calculationJs(ann.calculation));
          calcOrderRefs.push(tf.ref);
        }
        if (ann.conditional) {
          pendingConditionals.push({
            triggerFieldName: ann.conditional.triggerField,
            targetFieldName: ann.fieldName,
            conditional: ann.conditional,
          });
        }
      } else if (ann.fieldKind === "checkbox") {
        const cb = form.createCheckBox(ann.fieldName);
        cb.addToPage(page, rect);
        if (ann.defaultValue === "true") cb.check();
      } else if (ann.fieldKind === "radio") {
        let rg = radioGroups.get(ann.fieldName);
        if (!rg) {
          rg = form.createRadioGroup(ann.fieldName);
          radioGroups.set(ann.fieldName, rg);
        }
        rg.addOptionToPage(ann.defaultValue?.trim() || `Option ${rg.acroField.getWidgets().length + 1}`, page, rect);
      } else if (ann.fieldKind === "dropdown") {
        const dd = form.createDropdown(ann.fieldName);
        if (ann.options?.length) dd.addOptions(ann.options);
        dd.addToPage(page, rect);
        if (ann.defaultValue) dd.select(ann.defaultValue);
      }
    }
  });

  for (const { triggerFieldName, targetFieldName, conditional } of pendingConditionals) {
    const trigger = textFieldsByName.get(triggerFieldName);
    if (trigger) setFieldAction(trigger, context, "V", conditionalJs(targetFieldName, conditional));
  }

  if (calcOrderRefs.length > 0) {
    acroFormDict.set(PDFName.of("CO"), context.obj(calcOrderRefs as never[]));
  }
}
