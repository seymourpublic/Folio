"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Settings2,
  MousePointer2,
  Highlighter,
  Underline,
  Strikethrough,
  Waves,
  Pencil,
  Type,
  TextCursor,
  Quote,
  StickyNote,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  ImagePlus,
  Stamp,
  Ruler,
  Download,
  Signature,
  Ban,
  ScanText,
  Lock,
  Droplet,
  FileCog,
  FileDown,
  FileText,
  Info,
  Hash,
  Bookmark,
  Scissors,
  Link2,
  FileArchive,
  FileImage,
  FileSignature,
  Layers2,
  ShieldCheck,
  TextCursorInput,
  CheckSquare,
  CircleDot,
  ChevronDownSquare,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STAMP_PRESETS, MEASUREMENT_UNITS, type Tool, type MeasurementUnit } from "@folio/engine";
import type { PendingStamp } from "./AnnotationLayer";
import { loadToolbarLayout, saveToolbarLayout, type ToolbarItemId, type ToolbarLayout } from "@/lib/toolbar-config";
import { ToolbarCustomizeDialog } from "./ToolbarCustomizeDialog";
import type { DocMode } from "./ModeTabs";

const COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5", "#f0abfc", "#1f2937"];

const COLOR_TOOLS = new Set<Tool>([
  "highlight",
  "underline",
  "strikeout",
  "squiggly",
  "ink",
  "text",
  "rect",
  "ellipse",
  "line",
  "arrow",
  "callout",
  "measurement",
]);

export const MARKUP_TOOLS: Tool[] = ["highlight", "underline", "strikeout", "squiggly"];
export const SHAPE_TOOLS: Tool[] = ["rect", "ellipse", "line", "arrow", "callout"];
export const FORM_TOOLS: Tool[] = ["form-text", "form-checkbox", "form-radio", "form-dropdown", "form-date"];

export const TOOLS: { tool: Tool; icon: typeof MousePointer2; label: string }[] = [
  { tool: "ink", icon: Pencil, label: "Draw" },
  { tool: "text", icon: Type, label: "Add text" },
  { tool: "edit-text", icon: TextCursor, label: "Edit existing text (click a line of text on the page)" },
  { tool: "note", icon: StickyNote, label: "Add sticky note" },
  { tool: "link", icon: Link2, label: "Add link" },
  { tool: "measurement", icon: Ruler, label: "Measure distance" },
  { tool: "whiteout", icon: Eraser, label: "Whiteout (cosmetic cover-up only)" },
  { tool: "redact", icon: Ban, label: "Redact (permanently removes content)" },
];

export const MARKUP_ICON: Record<string, typeof Highlighter> = {
  highlight: Highlighter,
  underline: Underline,
  strikeout: Strikethrough,
  squiggly: Waves,
};

const SHAPE_ICON: Record<string, typeof Square> = {
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  callout: Quote,
};

export const MARKUP_LABEL: Record<string, string> = {
  highlight: "Highlight",
  underline: "Underline",
  strikeout: "Strikeout",
  squiggly: "Squiggly underline",
};

export const SHAPE_LABEL: Record<string, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
  callout: "Callout",
};

const FORM_ICON: Record<string, typeof Square> = {
  "form-text": TextCursorInput,
  "form-checkbox": CheckSquare,
  "form-radio": CircleDot,
  "form-dropdown": ChevronDownSquare,
  "form-date": CalendarDays,
};

export const FORM_LABEL: Record<string, string> = {
  "form-text": "Text field",
  "form-checkbox": "Checkbox",
  "form-radio": "Radio button",
  "form-dropdown": "Dropdown",
  "form-date": "Date field",
};

type EditToolbarProps = {
  tool: Tool;
  color: string;
  mode: DocMode;
  formsSubMode: "create" | "fill";
  onFormsSubModeChange: (mode: "create" | "fill") => void;
  measurementUnit: MeasurementUnit;
  onMeasurementUnitChange: (unit: MeasurementUnit) => void;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onImageChosen: (dataUrl: string, width: number, height: number) => void;
  onStampChosen: (stamp: PendingStamp) => void;
  onDownload: () => void;
  onOpenSignature: () => void;
  onOpenWatermark: () => void;
  onOpenPassword: () => void;
  onOpenMetadata: () => void;
  onOpenExport: () => void;
  onOpenProperties: () => void;
  onOpenPageNumbers: () => void;
  onOpenBookmarks: () => void;
  onOpenSplit: () => void;
  onOpenCompress: () => void;
  onExportSvg: () => void;
  onOpenCertificateSign: () => void;
  onOpenBulkSign: () => void;
  onOpenSecurityCenter: () => void;
  onOpenFormData: () => void;
  onRunOcr: () => void;
  isOcrRunning: boolean;
  isEncrypted: boolean;
  onUnlock: () => void;
};

export function EditToolbar({
  tool,
  color,
  mode,
  formsSubMode,
  onFormsSubModeChange,
  measurementUnit,
  onMeasurementUnitChange,
  onToolChange,
  onColorChange,
  onImageChosen,
  onStampChosen,
  onDownload,
  onOpenSignature,
  onOpenWatermark,
  onOpenPassword,
  onOpenMetadata,
  onOpenExport,
  onOpenProperties,
  onOpenPageNumbers,
  onOpenBookmarks,
  onOpenSplit,
  onOpenCompress,
  onExportSvg,
  onOpenCertificateSign,
  onOpenBulkSign,
  onOpenSecurityCenter,
  onOpenFormData,
  onRunOcr,
  isOcrRunning,
  isEncrypted,
  onUnlock,
}: EditToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stampFileInputRef = useRef<HTMLInputElement | null>(null);
  const [layout, setLayout] = useState<ToolbarLayout>(() => loadToolbarLayout());
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  function updateLayout(next: ToolbarLayout) {
    setLayout(next);
    saveToolbarLayout(next);
  }

  function rasterizeSvgFile(dataUrl: string, onDone: (dataUrl: string, width: number, height: number) => void) {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 512;
      const height = img.naturalHeight || 512;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      onDone(canvas.toDataURL("image/png"), width, height);
    };
    img.src = dataUrl;
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === "image/svg+xml") {
        rasterizeSvgFile(dataUrl, onImageChosen);
        return;
      }
      const img = new Image();
      img.onload = () => onImageChosen(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleStampImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const place = (finalDataUrl: string, width: number, height: number) => {
        const w = Math.min(200, width);
        onStampChosen({ dataUrl: finalDataUrl, width: w, height: w * (height / width) });
      };
      if (file.type === "image/svg+xml") {
        rasterizeSvgFile(dataUrl, place);
        return;
      }
      const img = new Image();
      img.onload = () => place(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const activeMarkupIcon = MARKUP_ICON[MARKUP_TOOLS.includes(tool) ? tool : "highlight"];
  const ActiveMarkupIcon = activeMarkupIcon;
  const activeShapeIcon = SHAPE_ICON[SHAPE_TOOLS.includes(tool) ? tool : "rect"];
  const ActiveShapeIcon = activeShapeIcon;
  const activeFormIcon = FORM_ICON[FORM_TOOLS.includes(tool) ? tool : "form-text"];
  const ActiveFormIcon = activeFormIcon;

  function renderItem(id: ToolbarItemId): ReactNode {
    switch (id) {
      case "markup":
        return (
          <DropdownMenu key={id}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant={MARKUP_TOOLS.includes(tool) ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Markup tools"
                />
              }
            >
              <ActiveMarkupIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {MARKUP_TOOLS.map((t) => {
                const Icon = MARKUP_ICON[t];
                return (
                  <DropdownMenuItem key={t} onClick={() => onToolChange(t)}>
                    <Icon className="h-4 w-4" />
                    {MARKUP_LABEL[t]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "shapes":
        return (
          <DropdownMenu key={id}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant={SHAPE_TOOLS.includes(tool) ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Shape tools"
                />
              }
            >
              <ActiveShapeIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SHAPE_TOOLS.map((t) => {
                const Icon = SHAPE_ICON[t];
                return (
                  <DropdownMenuItem key={t} onClick={() => onToolChange(t)}>
                    <Icon className="h-4 w-4" />
                    {SHAPE_LABEL[t]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "forms":
        return (
          <DropdownMenu key={id}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant={FORM_TOOLS.includes(tool) ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Form field tools"
                />
              }
            >
              <ActiveFormIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {FORM_TOOLS.map((t) => {
                const Icon = FORM_ICON[t];
                return (
                  <DropdownMenuItem key={t} onClick={() => onToolChange(t)}>
                    <Icon className="h-4 w-4" />
                    {FORM_LABEL[t]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "image":
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <Button
                  variant={tool === "image" ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Add image"
                  onClick={() => fileInputRef.current?.click()}
                />
              }
            >
              <ImagePlus className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Add image (PNG, JPEG, SVG)</TooltipContent>
          </Tooltip>
        );
      case "stamp":
        return (
          <DropdownMenu key={id}>
            <DropdownMenuTrigger
              render={<Button variant={tool === "stamp" ? "secondary" : "ghost"} size="icon" aria-label="Stamp" />}
            >
              <Stamp className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STAMP_PRESETS.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onStampChosen({ presetId: p.id, label: p.label, color: p.color, width: 160, height: 50 })}
                >
                  <span className="text-xs font-bold tracking-wide" style={{ color: p.color }}>
                    {p.label}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => stampFileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                Custom image stamp…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "sign":
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" aria-label="Sign" onClick={onOpenSignature} />}
            >
              <Signature className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Sign</TooltipContent>
          </Tooltip>
        );
      default: {
        const entry = TOOLS.find((t) => t.tool === id);
        if (!entry) return null;
        const Icon = entry.icon;
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <Button
                  variant={tool === entry.tool ? "secondary" : "ghost"}
                  size="icon"
                  aria-label={entry.label}
                  onClick={() => onToolChange(entry.tool)}
                />
              }
            >
              <Icon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>{entry.label}</TooltipContent>
          </Tooltip>
        );
      }
    }
  }

  const visibleItems = layout.order.filter((id) => !layout.hidden.includes(id));

  return (
    <div className="bg-background flex h-12 shrink-0 items-center gap-1 border-b px-3">
      {mode !== "view" && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={tool === "select" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Select & move"
                onClick={() => onToolChange("select")}
              />
            }
          >
            <MousePointer2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Select &amp; move</TooltipContent>
        </Tooltip>
      )}

      {mode === "annotate" && visibleItems.map((id) => renderItem(id))}

      {mode === "forms" && (
        <>
          <div className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
            <button
              onClick={() => onFormsSubModeChange("fill")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                formsSubMode === "fill" ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              Fill
            </button>
            <button
              onClick={() => onFormsSubModeChange("create")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                formsSubMode === "create" ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              Create
            </button>
          </div>
          {formsSubMode === "create" && (
            <>
              <Separator orientation="vertical" className="mx-1 h-6" />
              {FORM_TOOLS.map((t) => renderItem(t as ToolbarItemId))}
            </>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={stampFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleStampImageFile(file);
          e.target.value = "";
        }}
      />

      {mode === "annotate" && COLOR_TOOLS.has(tool) && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => onColorChange(c)}
                className={cn(
                  "h-5 w-5 rounded-full border",
                  color === c ? "ring-2 ring-primary ring-offset-1" : "border-border"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}

      {mode === "annotate" && tool === "measurement" && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <select
            className="h-7 rounded border bg-background px-1 text-xs"
            value={measurementUnit}
            onChange={(e) => onMeasurementUnitChange(e.target.value as MeasurementUnit)}
            aria-label="Measurement unit"
          >
            {MEASUREMENT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Make searchable (OCR)"
              disabled={isOcrRunning}
              onClick={onRunOcr}
            />
          }
        >
          <ScanText className={cn("h-4 w-4", isOcrRunning && "animate-pulse")} />
        </TooltipTrigger>
        <TooltipContent>Make searchable (OCR)</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Document tools" />}
        >
          <FileCog className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpenExport}>
            <FileDown className="h-4 w-4" />
            Export as…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenProperties}>
            <Info className="h-4 w-4" />
            Properties…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenMetadata}>
            <FileText className="h-4 w-4" />
            Document metadata…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenBookmarks}>
            <Bookmark className="h-4 w-4" />
            Bookmarks…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenPageNumbers}>
            <Hash className="h-4 w-4" />
            Page numbers &amp; header/footer…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenWatermark}>
            <Droplet className="h-4 w-4" />
            Add watermark…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSplit}>
            <Scissors className="h-4 w-4" />
            Split document…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenCompress}>
            <FileArchive className="h-4 w-4" />
            Compress document…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportSvg}>
            <FileImage className="h-4 w-4" />
            Export current page as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenFormData}>
            <TextCursorInput className="h-4 w-4" />
            Form data (auto-fill, import/export)…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isEncrypted ? (
            <DropdownMenuItem onClick={onUnlock}>
              <Lock className="h-4 w-4" />
              Remove password…
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onOpenPassword}>
              <Lock className="h-4 w-4" />
              Password protect…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenCertificateSign}>
            <FileSignature className="h-4 w-4" />
            Sign with certificate…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenBulkSign}>
            <Layers2 className="h-4 w-4" />
            Bulk sign multiple files…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenSecurityCenter}>
            <ShieldCheck className="h-4 w-4" />
            Security center…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCustomizeOpen(true)}>
            <Settings2 className="h-4 w-4" />
            Customize toolbar…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon" aria-label="Download PDF" onClick={onDownload} />}
        >
          <Download className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Download PDF</TooltipContent>
      </Tooltip>

      <ToolbarCustomizeDialog
        open={isCustomizeOpen}
        onOpenChange={setIsCustomizeOpen}
        layout={layout}
        onChange={updateLayout}
      />
    </div>
  );
}
