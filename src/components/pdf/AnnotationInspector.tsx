"use client";

import { useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCw,
  Crop,
  Replace,
  Contrast,
  Sun,
  Droplets,
  Palette,
  MoveHorizontal,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { Annotation, FontFamily } from "@folio/engine";

type AnnotationInspectorProps = {
  annotation: Annotation;
  onUpdate: (patch: Partial<Annotation>) => void;
  onOpenImageEdit: () => void;
  onReplaceImage: (dataUrl: string, width: number, height: number) => void;
  onOpenFieldProperties: () => void;
};

const FONT_OPTIONS: { id: FontFamily; label: string }[] = [
  { id: "helvetica", label: "Helvetica" },
  { id: "times", label: "Times" },
  { id: "courier", label: "Courier" },
  { id: "noto", label: "Noto Sans (Unicode)" },
];

function isTextLike(a: Annotation): a is Extract<Annotation, { type: "text" | "callout" }> {
  return a.type === "text" || a.type === "callout";
}

function firstValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

export function AnnotationInspector({
  annotation,
  onUpdate,
  onOpenImageEdit,
  onReplaceImage,
  onOpenFieldProperties,
}: AnnotationInspectorProps) {
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  function handleReplaceFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => onReplaceImage(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  if (isTextLike(annotation)) {
    const a = annotation;
    return (
      <div className="bg-background flex h-10 shrink-0 items-center gap-1 border-b px-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={a.bold ? "secondary" : "ghost"}
                size="icon"
                aria-label="Bold"
                onClick={() => onUpdate({ bold: !a.bold })}
              />
            }
          >
            <Bold className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Bold</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={a.italic ? "secondary" : "ghost"}
                size="icon"
                aria-label="Italic"
                onClick={() => onUpdate({ italic: !a.italic })}
              />
            }
          >
            <Italic className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Italic</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={a.underline ? "secondary" : "ghost"}
                size="icon"
                aria-label="Underline"
                onClick={() => onUpdate({ underline: !a.underline })}
              />
            }
          >
            <UnderlineIcon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Underline</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {(["left", "center", "right"] as const).map((align) => {
          const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
          return (
            <Tooltip key={align}>
              <TooltipTrigger
                render={
                  <Button
                    variant={(a.align ?? "left") === align ? "secondary" : "ghost"}
                    size="icon"
                    aria-label={`Align ${align}`}
                    onClick={() => onUpdate({ align })}
                  />
                }
              >
                <Icon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Align {align}</TooltipContent>
            </Tooltip>
          );
        })}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <select
          className="h-7 rounded border bg-background px-1 text-xs"
          value={a.fontFamily ?? "helvetica"}
          onChange={(e) => onUpdate({ fontFamily: e.target.value as FontFamily })}
          aria-label="Font family"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={6}
          max={96}
          value={a.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) || a.fontSize })}
          className="h-7 w-14 rounded border bg-background px-1 text-xs"
          aria-label="Font size"
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={a.direction === "rtl" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Right-to-left text"
                onClick={() => onUpdate({ direction: a.direction === "rtl" ? "ltr" : "rtl" })}
              />
            }
          >
            <MoveHorizontal className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Right-to-left (basic — no Arabic shaping)</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  if (annotation.type === "image") {
    const a = annotation;
    return (
      <div className="bg-background flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rotate 90°"
                onClick={() => onUpdate({ rotation: ((a.rotation ?? 0) + 90) % 360 })}
              />
            }
          >
            <RotateCw className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Rotate 90°</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1.5">
          <Sun className="text-muted-foreground h-3.5 w-3.5" />
          <Slider
            className="w-20"
            min={0.3}
            max={2}
            step={0.05}
            value={[a.filters?.brightness ?? 1]}
            onValueChange={(v) => onUpdate({ filters: { ...a.filters, brightness: firstValue(v) } })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Contrast className="text-muted-foreground h-3.5 w-3.5" />
          <Slider
            className="w-20"
            min={0.3}
            max={2}
            step={0.05}
            value={[a.filters?.contrast ?? 1]}
            onValueChange={(v) => onUpdate({ filters: { ...a.filters, contrast: firstValue(v) } })}
          />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={a.filters?.grayscale ? "secondary" : "ghost"}
                size="icon"
                aria-label="Grayscale"
                onClick={() => onUpdate({ filters: { ...a.filters, grayscale: a.filters?.grayscale ? 0 : 1 } })}
              />
            }
          >
            <Palette className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Grayscale</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1.5">
          <Droplets className="text-muted-foreground h-3.5 w-3.5" />
          <Slider
            className="w-20"
            min={0}
            max={1}
            step={0.05}
            value={[a.opacity ?? 1]}
            onValueChange={(v) => onUpdate({ opacity: firstValue(v) })}
          />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="Crop / mask…" onClick={onOpenImageEdit} />}
          >
            <Crop className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Crop / mask…</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Replace image" onClick={() => replaceInputRef.current?.click()} />
            }
          >
            <Replace className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Replace image</TooltipContent>
        </Tooltip>
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleReplaceFile(file);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (annotation.type === "form-field-create") {
    const a = annotation;
    return (
      <div className="bg-background flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Input
          value={a.fieldName}
          onChange={(e) => onUpdate({ fieldName: e.target.value })}
          className="h-7 w-40 text-xs"
          placeholder="Field name"
        />
        {a.fieldKind !== "checkbox" && (
          <Input
            value={a.defaultValue ?? ""}
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            className="h-7 w-40 text-xs"
            placeholder={a.fieldKind === "radio" ? "Option value" : "Default value"}
          />
        )}
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={a.defaultValue === "true"}
            onCheckedChange={(c) => onUpdate({ defaultValue: c ? "true" : "false" })}
            className={a.fieldKind === "checkbox" ? "" : "hidden"}
          />
          {a.fieldKind === "checkbox" && "Checked by default"}
        </label>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenFieldProperties}>
          <Settings2 className="h-3.5 w-3.5" />
          Advanced…
        </Button>
      </div>
    );
  }

  return null;
}

export function isInspectable(a: Annotation): boolean {
  return isTextLike(a) || a.type === "image" || a.type === "form-field-create";
}
