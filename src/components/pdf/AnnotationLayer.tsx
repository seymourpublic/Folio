"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createId,
  distanceInPoints,
  formatDistance,
  stampPreset,
  type Annotation,
  type Point,
  type Tool,
  type MeasurementUnit,
} from "@folio/engine";

export type PendingImage = { dataUrl: string; width: number; height: number };
export type PendingStamp = {
  presetId?: NonNullable<Extract<Annotation, { type: "stamp" }>["presetId"]>;
  label?: string;
  color?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
};
type PageOption = { id: string; label: string };

type AnnotationLayerProps = {
  size: { width: number; height: number };
  scale: number;
  annotations: Annotation[];
  tool: Tool;
  color: string;
  pendingImage: PendingImage | null;
  pendingStamp: PendingStamp | null;
  measurementUnit: MeasurementUnit;
  pageOptions: PageOption[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
  onAdd: (annotation: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onImagePlaced: () => void;
  onStampPlaced: () => void;
};

type BBox = { x: number; y: number; width: number; height: number };

const BOX_TOOLS = new Set<Tool>([
  "highlight",
  "whiteout",
  "redact",
  "link",
  "rect",
  "ellipse",
  "underline",
  "strikeout",
  "squiggly",
]);
const LINE_TOOLS = new Set<Tool>(["line", "arrow", "measurement"]);
const FORM_CREATE_TOOL_KIND: Partial<Record<Tool, "text" | "checkbox" | "radio" | "dropdown" | "date">> = {
  "form-text": "text",
  "form-checkbox": "checkbox",
  "form-radio": "radio",
  "form-dropdown": "dropdown",
  "form-date": "date",
};

function boundingBox(a: Annotation): BBox {
  switch (a.type) {
    case "ink": {
      const xs = a.points.map((p) => p.x);
      const ys = a.points.map((p) => p.y);
      const pad = a.strokeWidth + 4;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      return { x: minX, y: minY, width: Math.max(...xs) - minX + pad, height: Math.max(...ys) - minY + pad };
    }
    case "text":
      return {
        x: a.x,
        y: a.y - a.fontSize,
        width: Math.max(40, a.text.length * a.fontSize * 0.55),
        height: a.fontSize * 1.5,
      };
    case "note":
      return { x: a.x, y: a.y, width: 180, height: 70 };
    case "line":
    case "arrow":
    case "measurement": {
      const pad = 18;
      const minX = Math.min(a.x1, a.x2) - pad;
      const minY = Math.min(a.y1, a.y2) - pad;
      return {
        x: minX,
        y: minY,
        width: Math.max(a.x1, a.x2) - minX + pad,
        height: Math.max(a.y1, a.y2) - minY + pad,
      };
    }
    case "callout": {
      const pad = 4;
      const minX = Math.min(a.x, a.pointerX) - pad;
      const minY = Math.min(a.y, a.pointerY) - pad;
      const maxX = Math.max(a.x + a.width, a.pointerX) + pad;
      const maxY = Math.max(a.y + a.height, a.pointerY) + pad;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    default:
      return { x: a.x, y: a.y, width: a.width, height: a.height };
  }
}

function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  const p1 = { x: x2 + size * Math.cos(a1), y: y2 + size * Math.sin(a1) };
  const p2 = { x: x2 + size * Math.cos(a2), y: y2 + size * Math.sin(a2) };
  return `${x2},${y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

type DragOrigin =
  | { kind: "point"; x: number; y: number }
  | { kind: "twoPoint"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "callout"; x: number; y: number; pointerX: number; pointerY: number }
  | { kind: "ink"; points: Point[] };

export function AnnotationLayer({
  size,
  scale,
  annotations,
  tool,
  color,
  pendingImage,
  pendingStamp,
  measurementUnit,
  pageOptions,
  selectedId,
  onSelectId,
  editingId,
  onSetEditingId,
  onAdd,
  onUpdate,
  onDelete,
  onImagePlaced,
  onStampPlaced,
}: AnnotationLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draftRect, setDraftRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [draftInk, setDraftInk] = useState<Point[] | null>(null);
  const [draftLine, setDraftLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [draftText, setDraftText] = useState<{
    x: number;
    y: number;
    value: string;
    kind: "text" | "note" | "callout";
    pointerX?: number;
    pointerY?: number;
  } | null>(null);

  const dragRef = useRef<{ id: string; startX: number; startY: number; origin: DragOrigin } | null>(null);
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
  } | null>(null);
  const endpointRef = useRef<{ id: string; which: "1" | "2"; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pointerTipRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  function toPageSpace(clientX: number, clientY: number): Point {
    const rect = rootRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  function handleContainerPointerDown(e: React.PointerEvent) {
    if (tool === "select") return;
    e.preventDefault();
    const point = toPageSpace(e.clientX, e.clientY);

    if (BOX_TOOLS.has(tool) || tool in FORM_CREATE_TOOL_KIND) {
      setDraftRect({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (LINE_TOOLS.has(tool)) {
      setDraftLine({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (tool === "ink") {
      setDraftInk([point]);
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (tool === "callout") {
      setDraftText({
        x: point.x + 50,
        y: point.y - 70,
        value: "",
        kind: "callout",
        pointerX: point.x,
        pointerY: point.y,
      });
    } else if (tool === "text" || tool === "note") {
      setDraftText({ x: point.x, y: point.y, value: "", kind: tool });
    } else if (tool === "image" && pendingImage) {
      const width = Math.min(220, pendingImage.width);
      const height = width * (pendingImage.height / pendingImage.width);
      onAdd({
        id: createId(),
        type: "image",
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        dataUrl: pendingImage.dataUrl,
        rotation: 0,
        opacity: 1,
      });
      onImagePlaced();
    } else if (tool === "stamp" && pendingStamp) {
      const width = pendingStamp.width ?? 160;
      const height = pendingStamp.height ?? 50;
      onAdd({
        id: createId(),
        type: "stamp",
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        dataUrl: pendingStamp.dataUrl,
        presetId: pendingStamp.presetId,
        label: pendingStamp.label,
        color: pendingStamp.color,
      });
      onStampPlaced();
    }
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (draftRect) {
      const point = toPageSpace(e.clientX, e.clientY);
      setDraftRect({ ...draftRect, x1: point.x, y1: point.y });
    } else if (draftInk) {
      const point = toPageSpace(e.clientX, e.clientY);
      setDraftInk([...draftInk, point]);
    } else if (draftLine) {
      const point = toPageSpace(e.clientX, e.clientY);
      setDraftLine({ ...draftLine, x2: point.x, y2: point.y });
    }
  }

  function handleContainerPointerUp() {
    if (draftRect) {
      const x = Math.min(draftRect.x0, draftRect.x1);
      const y = Math.min(draftRect.y0, draftRect.y1);
      const width = Math.abs(draftRect.x1 - draftRect.x0);
      const isThinMarkup = tool === "underline" || tool === "strikeout" || tool === "squiggly";
      const height = isThinMarkup ? Math.max(14, Math.abs(draftRect.y1 - draftRect.y0)) : Math.abs(draftRect.y1 - draftRect.y0);
      if (isThinMarkup ? width > 3 : width > 3 && height > 3) {
        if (tool === "highlight") {
          onAdd({ id: createId(), type: "highlight", x, y, width, height, color });
        } else if (tool === "redact") {
          onAdd({ id: createId(), type: "redact", x, y, width, height });
        } else if (tool === "link") {
          const id = createId();
          onAdd({ id, type: "link", x, y, width, height, target: { kind: "url", url: "" } });
          onSetEditingId(id);
        } else if (tool === "rect") {
          onAdd({ id: createId(), type: "rect", x, y, width, height, color, filled: false, strokeWidth: 2 });
        } else if (tool === "ellipse") {
          onAdd({ id: createId(), type: "ellipse", x, y, width, height, color, filled: false, strokeWidth: 2 });
        } else if (isThinMarkup) {
          onAdd({ id: createId(), type: tool, x, y, width, height, color });
        } else if (tool in FORM_CREATE_TOOL_KIND) {
          const fieldKind = FORM_CREATE_TOOL_KIND[tool]!;
          const fieldName = `Field_${createId().slice(0, 6)}`;
          onAdd({
            id: createId(),
            type: "form-field-create",
            fieldKind,
            fieldName,
            x,
            y,
            width,
            height,
            options: fieldKind === "dropdown" ? ["Option 1", "Option 2"] : undefined,
          });
        } else {
          onAdd({ id: createId(), type: "rect", x, y, width, height, color: "#ffffff", filled: true, strokeWidth: 0 });
        }
      }
      setDraftRect(null);
    } else if (draftInk) {
      if (draftInk.length > 1) {
        onAdd({ id: createId(), type: "ink", points: draftInk, color, strokeWidth: 2.5 });
      }
      setDraftInk(null);
    } else if (draftLine) {
      const dist = Math.hypot(draftLine.x2 - draftLine.x1, draftLine.y2 - draftLine.y1);
      if (dist > 4) {
        if (tool === "measurement") {
          onAdd({ id: createId(), type: "measurement", ...draftLine, color, unit: measurementUnit });
        } else {
          onAdd({ id: createId(), type: tool === "arrow" ? "arrow" : "line", ...draftLine, color, strokeWidth: 2.5 });
        }
      }
      setDraftLine(null);
    }
  }

  function commitDraftText() {
    if (!draftText) return;
    const value = draftText.value.trim();
    if (value) {
      if (draftText.kind === "note") {
        onAdd({ id: createId(), type: "note", x: draftText.x, y: draftText.y, text: value, color: "#fde68a" });
      } else if (draftText.kind === "callout") {
        onAdd({
          id: createId(),
          type: "callout",
          x: draftText.x,
          y: draftText.y,
          width: 160,
          height: 60,
          pointerX: draftText.pointerX ?? draftText.x,
          pointerY: draftText.pointerY ?? draftText.y,
          text: value,
          fontSize: 12,
          color,
        });
      } else {
        onAdd({ id: createId(), type: "text", x: draftText.x, y: draftText.y, text: value, fontSize: 16, color });
      }
    }
    setDraftText(null);
  }

  function startDrag(e: React.PointerEvent, a: Annotation) {
    if (tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    onSelectId(a.id);
    let origin: DragOrigin;
    if (a.type === "ink") origin = { kind: "ink", points: a.points };
    else if (a.type === "line") origin = { kind: "twoPoint", x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
    else if (a.type === "arrow") origin = { kind: "twoPoint", x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
    else if (a.type === "measurement") origin = { kind: "twoPoint", x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
    else if (a.type === "callout") origin = { kind: "callout", x: a.x, y: a.y, pointerX: a.pointerX, pointerY: a.pointerY };
    else if ("x" in a && "y" in a) origin = { kind: "point", x: a.x, y: a.y };
    else origin = { kind: "point", x: 0, y: 0 };
    dragRef.current = { id: a.id, startX: e.clientX, startY: e.clientY, origin };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onDrag(e: React.PointerEvent, a: Annotation) {
    const drag = dragRef.current;
    if (!drag || drag.id !== a.id) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const o = drag.origin;
    if (o.kind === "ink") {
      onUpdate(a.id, { points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as Partial<Annotation>);
    } else if (o.kind === "twoPoint") {
      onUpdate(a.id, { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy } as Partial<Annotation>);
    } else if (o.kind === "callout") {
      onUpdate(a.id, { x: o.x + dx, y: o.y + dy, pointerX: o.pointerX + dx, pointerY: o.pointerY + dy } as Partial<Annotation>);
    } else {
      onUpdate(a.id, { x: o.x + dx, y: o.y + dy } as Partial<Annotation>);
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  function startResize(e: React.PointerEvent, a: Annotation & { x: number; y: number; width: number; height: number }) {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      id: a.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: a.x,
      originY: a.y,
      originW: a.width,
      originH: a.height,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onResize(e: React.PointerEvent, a: Annotation) {
    const r = resizeRef.current;
    if (!r || r.id !== a.id) return;
    const dx = (e.clientX - r.startX) / scale;
    const dy = (e.clientY - r.startY) / scale;
    onUpdate(a.id, { width: Math.max(8, r.originW + dx), height: Math.max(8, r.originH + dy) } as Partial<Annotation>);
  }

  function endResize() {
    resizeRef.current = null;
  }

  function startEndpointDrag(e: React.PointerEvent, a: Annotation, which: "1" | "2") {
    if (a.type !== "line" && a.type !== "arrow" && a.type !== "measurement") return;
    e.stopPropagation();
    e.preventDefault();
    onSelectId(a.id);
    endpointRef.current = {
      id: a.id,
      which,
      startX: e.clientX,
      startY: e.clientY,
      originX: which === "1" ? a.x1 : a.x2,
      originY: which === "1" ? a.y1 : a.y2,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onEndpointDrag(e: React.PointerEvent, a: Annotation) {
    const r = endpointRef.current;
    if (!r || r.id !== a.id) return;
    const dx = (e.clientX - r.startX) / scale;
    const dy = (e.clientY - r.startY) / scale;
    if (r.which === "1") onUpdate(a.id, { x1: r.originX + dx, y1: r.originY + dy } as Partial<Annotation>);
    else onUpdate(a.id, { x2: r.originX + dx, y2: r.originY + dy } as Partial<Annotation>);
  }

  function endEndpointDrag() {
    endpointRef.current = null;
  }

  function startPointerTipDrag(e: React.PointerEvent, a: Annotation) {
    if (a.type !== "callout") return;
    e.stopPropagation();
    e.preventDefault();
    onSelectId(a.id);
    pointerTipRef.current = { id: a.id, startX: e.clientX, startY: e.clientY, originX: a.pointerX, originY: a.pointerY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerTipDrag(e: React.PointerEvent, a: Annotation) {
    const r = pointerTipRef.current;
    if (!r || r.id !== a.id) return;
    const dx = (e.clientX - r.startX) / scale;
    const dy = (e.clientY - r.startY) / scale;
    onUpdate(a.id, { pointerX: r.originX + dx, pointerY: r.originY + dy } as Partial<Annotation>);
  }

  function endPointerTipDrag() {
    pointerTipRef.current = null;
  }

  return (
    <div
      ref={rootRef}
      className="absolute top-0 left-0"
      style={{
        width: size.width,
        height: size.height,
        pointerEvents: tool === "select" || tool === "edit-text" ? "none" : "auto",
        cursor: tool === "select" ? "default" : tool === "edit-text" ? "text" : "crosshair",
      }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
    >
      {annotations.map((a) => {
        const box = boundingBox(a);
        const style: React.CSSProperties = {
          position: "absolute",
          left: box.x * scale,
          top: box.y * scale,
          width: box.width * scale,
          height: box.height * scale,
          pointerEvents: tool === "select" || (tool === "edit-text" && a.type === "text-edit") ? "auto" : "none",
        };
        const isSelected = tool === "select" && selectedId === a.id;
        const resizable = "width" in a && "height" in a && a.type !== "form-field";

        return (
          <div
            key={a.id}
            style={style}
            className={cn("group", tool === "select" && "cursor-move")}
            onPointerDown={(e) => startDrag(e, a)}
            onPointerMove={(e) => onDrag(e, a)}
            onPointerUp={endDrag}
            onClick={(e) => {
              e.stopPropagation();
              onSelectId(a.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (a.type === "text" || a.type === "note" || a.type === "link" || a.type === "callout" || a.type === "text-edit")
                onSetEditingId(a.id);
            }}
          >
            {a.type === "highlight" && (
              <div className="h-full w-full" style={{ backgroundColor: a.color, opacity: 0.4 }} />
            )}

            {(a.type === "underline" || a.type === "strikeout" || a.type === "squiggly") && (
              <svg className="h-full w-full overflow-visible">
                {a.type === "underline" && (
                  <line x1={0} y1={box.height * scale} x2={box.width * scale} y2={box.height * scale} stroke={a.color} strokeWidth={2} />
                )}
                {a.type === "strikeout" && (
                  <line
                    x1={0}
                    y1={(box.height * scale) / 2}
                    x2={box.width * scale}
                    y2={(box.height * scale) / 2}
                    stroke={a.color}
                    strokeWidth={2}
                  />
                )}
                {a.type === "squiggly" && (
                  <path
                    d={Array.from({ length: Math.max(2, Math.ceil((box.width * scale) / 8)) })
                      .map((_, i) => {
                        const x = i * 8;
                        const y = box.height * scale - (i % 2 === 0 ? 0 : 5);
                        return `${i === 0 ? "M" : "L"}${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={2}
                  />
                )}
              </svg>
            )}

            {a.type === "rect" && (
              <div
                className={cn("h-full w-full", !a.filled && "border-2 border-dashed")}
                style={
                  a.filled
                    ? { backgroundColor: a.color }
                    : { borderColor: a.color, borderStyle: "solid", borderWidth: a.strokeWidth ?? 2 }
                }
              />
            )}

            {a.type === "ellipse" && (
              <div
                className={cn("h-full w-full rounded-[50%]", !a.filled && "border-2")}
                style={
                  a.filled
                    ? { backgroundColor: a.color, borderRadius: "50%" }
                    : { borderColor: a.color, borderStyle: "solid", borderWidth: a.strokeWidth ?? 2, borderRadius: "50%" }
                }
              />
            )}

            {a.type === "redact" && (
              <div className="flex h-full w-full items-center justify-center bg-black">
                <span className="text-[10px] font-medium tracking-wide text-red-500">REDACTED</span>
              </div>
            )}

            {a.type === "ink" && (
              <svg className="h-full w-full overflow-visible">
                <polyline
                  points={a.points.map((p) => `${(p.x - box.x) * scale},${(p.y - box.y) * scale}`).join(" ")}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={a.strokeWidth * scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {(a.type === "line" || a.type === "arrow") && (
              <svg className="h-full w-full overflow-visible" style={{ pointerEvents: "none" }}>
                <line
                  x1={(a.x1 - box.x) * scale}
                  y1={(a.y1 - box.y) * scale}
                  x2={(a.x2 - box.x) * scale}
                  y2={(a.y2 - box.y) * scale}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth * scale}
                  strokeLinecap="round"
                />
                {a.type === "arrow" && (
                  <polygon
                    points={arrowHeadPoints(
                      (a.x1 - box.x) * scale,
                      (a.y1 - box.y) * scale,
                      (a.x2 - box.x) * scale,
                      (a.y2 - box.y) * scale,
                      8 * scale + 4
                    )}
                    fill={a.color}
                  />
                )}
              </svg>
            )}

            {a.type === "measurement" && (
              <>
                <svg className="h-full w-full overflow-visible" style={{ pointerEvents: "none" }}>
                  <line
                    x1={(a.x1 - box.x) * scale}
                    y1={(a.y1 - box.y) * scale}
                    x2={(a.x2 - box.x) * scale}
                    y2={(a.y2 - box.y) * scale}
                    stroke={a.color}
                    strokeWidth={1.5}
                  />
                </svg>
                <div
                  className="absolute rounded border bg-white/90 px-1 text-[10px] font-medium whitespace-nowrap shadow-sm"
                  style={{
                    left: ((a.x1 + a.x2) / 2 - box.x) * scale,
                    top: ((a.y1 + a.y2) / 2 - box.y) * scale,
                    transform: "translate(-50%, -50%)",
                    color: a.color,
                  }}
                >
                  {formatDistance(distanceInPoints(a.x1, a.y1, a.x2, a.y2), a.unit)}
                </div>
              </>
            )}

            {a.type === "text" &&
              (editingId === a.id ? (
                <textarea
                  autoFocus
                  defaultValue={a.text}
                  dir={a.direction === "rtl" ? "rtl" : "ltr"}
                  className="h-full w-full resize-none border border-primary bg-white/90 px-1 outline-none"
                  style={{
                    fontSize: a.fontSize * scale,
                    color: a.color,
                    fontWeight: a.bold ? 700 : 400,
                    fontStyle: a.italic ? "italic" : "normal",
                    textDecoration: a.underline ? "underline" : "none",
                    textAlign: a.align ?? "left",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    onSetEditingId(null);
                    if (value) onUpdate(a.id, { text: value });
                    else onDelete(a.id);
                  }}
                />
              ) : (
                <div
                  dir={a.direction === "rtl" ? "rtl" : "ltr"}
                  className="h-full w-full whitespace-pre-wrap"
                  style={{
                    fontSize: a.fontSize * scale,
                    color: a.color,
                    lineHeight: 1.3,
                    fontWeight: a.bold ? 700 : 400,
                    fontStyle: a.italic ? "italic" : "normal",
                    textDecoration: a.underline ? "underline" : "none",
                    textAlign: a.align ?? "left",
                  }}
                >
                  {a.text}
                </div>
              ))}

            {a.type === "text-edit" &&
              (editingId === a.id ? (
                <textarea
                  autoFocus
                  defaultValue={a.newText}
                  className="h-full w-full resize-none border border-primary bg-white px-0.5 outline-none"
                  style={{ fontSize: a.fontSize * scale, color: a.color, lineHeight: 1.2 }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const value = e.target.value;
                    onSetEditingId(null);
                    if (value.trim()) onUpdate(a.id, { newText: value });
                    else onDelete(a.id);
                  }}
                />
              ) : (
                <div
                  className="h-full w-full bg-white px-0.5"
                  style={{ fontSize: a.fontSize * scale, color: a.color, lineHeight: 1.2 }}
                >
                  {a.newText}
                </div>
              ))}

            {a.type === "note" &&
              (editingId === a.id ? (
                <textarea
                  autoFocus
                  defaultValue={a.text}
                  dir={a.direction === "rtl" ? "rtl" : "ltr"}
                  className="h-full w-full resize-none border border-amber-500 bg-amber-100 p-1 text-xs outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    onSetEditingId(null);
                    if (value) onUpdate(a.id, { text: value });
                    else onDelete(a.id);
                  }}
                />
              ) : (
                <div
                  dir={a.direction === "rtl" ? "rtl" : "ltr"}
                  className="h-full w-full overflow-hidden rounded-sm border border-amber-500 bg-amber-200 p-1.5 text-xs shadow-sm"
                >
                  {a.text}
                </div>
              ))}

            {a.type === "callout" && (
              <>
                <svg className="pointer-events-none absolute inset-0 overflow-visible">
                  <line
                    x1={(a.pointerX - box.x) * scale}
                    y1={(a.pointerY - box.y) * scale}
                    x2={(a.x - box.x) * scale + (a.width * scale) / 2}
                    y2={(a.y - box.y) * scale + (a.height * scale) / 2}
                    stroke={a.color}
                    strokeWidth={1.5}
                  />
                </svg>
                <div
                  className="absolute rounded border bg-white shadow-sm"
                  style={{
                    left: (a.x - box.x) * scale,
                    top: (a.y - box.y) * scale,
                    width: a.width * scale,
                    height: a.height * scale,
                    borderColor: a.color,
                  }}
                >
                  {editingId === a.id ? (
                    <textarea
                      autoFocus
                      defaultValue={a.text}
                      dir={a.direction === "rtl" ? "rtl" : "ltr"}
                      className="h-full w-full resize-none p-1 text-xs outline-none"
                      style={{
                        fontSize: a.fontSize * scale,
                        color: a.color,
                        fontWeight: a.bold ? 700 : 400,
                        fontStyle: a.italic ? "italic" : "normal",
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        onSetEditingId(null);
                        if (value) onUpdate(a.id, { text: value });
                        else onDelete(a.id);
                      }}
                    />
                  ) : (
                    <div
                      dir={a.direction === "rtl" ? "rtl" : "ltr"}
                      className="h-full w-full overflow-hidden p-1 text-xs whitespace-pre-wrap"
                      style={{
                        fontSize: a.fontSize * scale,
                        color: a.color,
                        fontWeight: a.bold ? 700 : 400,
                        fontStyle: a.italic ? "italic" : "normal",
                      }}
                    >
                      {a.text}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <div
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
                    style={{ left: (a.pointerX - box.x) * scale, top: (a.pointerY - box.y) * scale, cursor: "move" }}
                    onPointerDown={(e) => startPointerTipDrag(e, a)}
                    onPointerMove={(e) => onPointerTipDrag(e, a)}
                    onPointerUp={endPointerTipDrag}
                  />
                )}
              </>
            )}

            {a.type === "image" && (
              <div
                className="h-full w-full overflow-hidden"
                style={{
                  opacity: a.opacity ?? 1,
                  transform: a.rotation ? `rotate(${a.rotation}deg)` : undefined,
                  clipPath:
                    a.maskShape === "ellipse" ? "ellipse(50% 50%)" : a.maskShape === "rounded" ? "inset(0 round 12%)" : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.dataUrl}
                  alt=""
                  draggable={false}
                  className={a.crop ? "absolute" : "h-full w-full object-contain"}
                  style={{
                    ...(a.crop
                      ? {
                          width: `${100 / a.crop.width}%`,
                          height: `${100 / a.crop.height}%`,
                          left: `${(-a.crop.x / a.crop.width) * 100}%`,
                          top: `${(-a.crop.y / a.crop.height) * 100}%`,
                          maxWidth: "none",
                        }
                      : {}),
                    filter: a.filters
                      ? [
                          a.filters.brightness != null ? `brightness(${a.filters.brightness})` : "",
                          a.filters.contrast != null ? `contrast(${a.filters.contrast})` : "",
                          a.filters.grayscale ? `grayscale(${a.filters.grayscale})` : "",
                          a.filters.sepia ? `sepia(${a.filters.sepia})` : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : undefined,
                  }}
                />
              </div>
            )}

            {a.type === "stamp" &&
              (a.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt="" className="h-full w-full object-contain" draggable={false} />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded border-4 p-1 text-center font-bold tracking-wider"
                  style={{
                    color: a.color ?? stampPreset(a.presetId)?.color ?? "#dc2626",
                    borderColor: a.color ?? stampPreset(a.presetId)?.color ?? "#dc2626",
                    transform: "rotate(-6deg)",
                    fontSize: Math.max(10, box.height * scale * 0.28),
                  }}
                >
                  {a.label ?? stampPreset(a.presetId)?.label ?? "STAMP"}
                </div>
              ))}

            {a.type === "form-field-create" && (
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-sm border-2 border-dashed border-purple-500 bg-purple-500/10 px-1">
                <span className="truncate text-[10px] font-medium text-purple-700">
                  {a.fieldName} ({a.fieldKind})
                </span>
              </div>
            )}

            {a.type === "link" &&
              (editingId === a.id ? (
                <div
                  className="absolute top-full left-0 z-10 mt-1 flex w-56 flex-col gap-1.5 rounded-md border bg-white p-2 text-xs shadow-lg"
                  style={{ pointerEvents: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetEditingId(null);
                  }}
                >
                  <div className="flex gap-1">
                    <button
                      className={cn(
                        "flex-1 rounded px-2 py-1",
                        a.target.kind === "url" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                      onClick={() => onUpdate(a.id, { target: { kind: "url", url: "" } })}
                    >
                      URL
                    </button>
                    <button
                      className={cn(
                        "flex-1 rounded px-2 py-1",
                        a.target.kind === "page" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                      onClick={() =>
                        onUpdate(a.id, {
                          target: { kind: "page", pageId: pageOptions[0]?.id ?? "" },
                        })
                      }
                    >
                      Page
                    </button>
                  </div>
                  {a.target.kind === "url" ? (
                    <input
                      autoFocus
                      placeholder="https://…"
                      defaultValue={a.target.url}
                      className="rounded border px-1.5 py-1"
                      onChange={(e) => onUpdate(a.id, { target: { kind: "url", url: e.target.value } })}
                    />
                  ) : (
                    <select
                      className="rounded border px-1.5 py-1"
                      value={a.target.pageId}
                      onChange={(e) => onUpdate(a.id, { target: { kind: "page", pageId: e.target.value } })}
                    >
                      {pageOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="mt-0.5 self-end text-primary underline" onClick={() => onSetEditingId(null)}>
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-sm border-2 border-dashed border-blue-400 bg-blue-400/10">
                  <span className="truncate px-1 text-[10px] font-medium text-blue-600">
                    {(() => {
                      const target = a.target;
                      return target.kind === "url"
                        ? target.url || "Set link…"
                        : (pageOptions.find((p) => p.id === target.pageId)?.label ?? "Set link…");
                    })()}
                  </span>
                </div>
              ))}

            {(a.type === "line" || a.type === "arrow" || a.type === "measurement") && isSelected && (
              <>
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-primary shadow"
                  style={{ left: (a.x1 - box.x) * scale, top: (a.y1 - box.y) * scale }}
                  onPointerDown={(e) => startEndpointDrag(e, a, "1")}
                  onPointerMove={(e) => onEndpointDrag(e, a)}
                  onPointerUp={endEndpointDrag}
                />
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-primary shadow"
                  style={{ left: (a.x2 - box.x) * scale, top: (a.y2 - box.y) * scale }}
                  onPointerDown={(e) => startEndpointDrag(e, a, "2")}
                  onPointerMove={(e) => onEndpointDrag(e, a)}
                  onPointerUp={endEndpointDrag}
                />
              </>
            )}

            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(a.id);
                  onSelectId(null);
                }}
                className="bg-destructive text-destructive-foreground absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {isSelected && <div className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-primary" />}
            {isSelected && resizable && (
              <div
                className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-primary shadow"
                onPointerDown={(e) => startResize(e, a as Annotation & { x: number; y: number; width: number; height: number })}
                onPointerMove={(e) => onResize(e, a)}
                onPointerUp={endResize}
              />
            )}
          </div>
        );
      })}

      {draftRect && (
        <div
          className="absolute border-2 border-dashed border-primary"
          style={{
            left: Math.min(draftRect.x0, draftRect.x1) * scale,
            top: Math.min(draftRect.y0, draftRect.y1) * scale,
            width: Math.abs(draftRect.x1 - draftRect.x0) * scale,
            height: Math.abs(draftRect.y1 - draftRect.y0) * scale,
            backgroundColor:
              tool === "highlight"
                ? color
                : tool === "redact"
                  ? "#000000"
                  : tool === "link"
                    ? "#60a5fa"
                    : tool === "rect" || tool === "ellipse"
                      ? "transparent"
                      : "#ffffff",
            opacity: tool === "highlight" ? 0.4 : tool === "link" ? 0.15 : 1,
          }}
        />
      )}

      {draftInk && (
        <svg className="pointer-events-none absolute inset-0 overflow-visible">
          <polyline
            points={draftInk.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2.5 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {draftLine && (
        <svg className="pointer-events-none absolute inset-0 overflow-visible">
          <line
            x1={draftLine.x1 * scale}
            y1={draftLine.y1 * scale}
            x2={draftLine.x2 * scale}
            y2={draftLine.y2 * scale}
            stroke={color}
            strokeWidth={2.5}
            strokeDasharray={tool === "measurement" ? "4 3" : undefined}
          />
        </svg>
      )}

      {draftText && (
        <textarea
          autoFocus
          className={cn(
            "absolute resize-none p-1 outline-none",
            draftText.kind === "note"
              ? "border border-amber-500 bg-amber-100 text-xs"
              : draftText.kind === "callout"
                ? "border bg-white text-xs"
                : "border border-primary bg-white/90"
          )}
          style={{
            left: draftText.x * scale,
            top: draftText.y * scale,
            width: draftText.kind === "note" ? 180 * scale : draftText.kind === "callout" ? 160 * scale : 200 * scale,
            height: draftText.kind === "note" ? 70 * scale : draftText.kind === "callout" ? 60 * scale : 40 * scale,
            fontSize: draftText.kind === "text" ? 16 * scale : undefined,
            color: draftText.kind === "text" ? color : undefined,
          }}
          onChange={(e) => {
            setDraftText(draftText && { ...draftText, value: e.target.value });
          }}
          onBlur={commitDraftText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDraftText(null);
          }}
        />
      )}
    </div>
  );
}
