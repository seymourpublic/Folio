"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pdfjsLib, type PdfDocumentProxy, type FontFamily } from "@folio/engine";
import { readRunStyle } from "@/lib/pdf/run-appearance";
import type { RenderTask } from "pdfjs-dist";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSize = { width: number; height: number };

type OptionalContentConfig = Awaited<ReturnType<PdfDocumentProxy["getOptionalContentConfig"]>>;

export type EditableTextRun = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  /** Appearance read off the rendered page; absent when the run's box was too varied to trust. */
  appearance?: { background: string; ink: string };
  font: { family: FontFamily; bold: boolean; italic: boolean };
};

type PdfPageCanvasProps = {
  doc: PdfDocumentProxy;
  sourcePageIndex: number;
  rotation: number;
  scale: number;
  searchQuery?: string;
  registerRef?: (el: HTMLDivElement | null) => void;
  renderOverlay?: (size: PageSize) => ReactNode;
  optionalContentConfig?: OptionalContentConfig | null;
  layersVersion?: number;
  /** When true, existing text-layer spans become clickable targets for in-place editing
   * instead of just a selection layer. */
  editTextMode?: boolean;
  onEditExistingText?: (run: EditableTextRun) => void;
};

export function PdfPageCanvas({
  doc,
  sourcePageIndex,
  rotation,
  scale,
  searchQuery,
  registerRef,
  renderOverlay,
  optionalContentConfig,
  layersVersion,
  editTextMode,
  onEditExistingText,
}: PdfPageCanvasProps) {
  const { ref: containerRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "1500px 0px",
    sticky: false,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<PageSize | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!isIntersecting) return;
    let cancelled = false;

    (async () => {
      const page = await doc.getPage(sourcePageIndex + 1);
      if (cancelled) return;

      const totalRotation = ((page.rotate + rotation) % 360 + 360) % 360;
      const viewport = page.getViewport({ scale, rotation: totalRotation });
      const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setSize({ width: viewport.width, height: viewport.height });

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform,
        canvas,
        optionalContentConfigPromise: optionalContentConfig
          ? Promise.resolve(optionalContentConfig)
          : undefined,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      if (cancelled) return;

      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = "";
        textLayerRef.current.style.setProperty("--scale-factor", String(viewport.scale));
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport,
        });
        await textLayer.render();
      }
    })().catch((err) => {
      if (!cancelled) console.error(`Failed to render page ${sourcePageIndex + 1}`, err);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, sourcePageIndex, rotation, scale, isIntersecting, layersVersion]);

  useEffect(() => {
    if (isIntersecting) return;
    const timeout = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas && (canvas.width > 0 || canvas.height > 0)) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (textLayerRef.current) textLayerRef.current.innerHTML = "";
    }, 400);
    return () => clearTimeout(timeout);
  }, [isIntersecting]);

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container || !editTextMode || !onEditExistingText) return;
    const onEdit = onEditExistingText;

    function handleClick(e: MouseEvent) {
      const span = (e.target as HTMLElement).closest("span");
      if (!span || !container!.contains(span) || !span.textContent?.trim()) return;
      e.stopPropagation();
      const containerRect = container!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      const fontSizePx = parseFloat(getComputedStyle(span).fontSize) || 12 * scale;
      onEdit({
        x: (spanRect.left - containerRect.left) / scale,
        y: (spanRect.top - containerRect.top) / scale,
        width: spanRect.width / scale,
        height: spanRect.height / scale,
        text: span.textContent,
        fontSize: fontSizePx / scale,
        ...readRunStyle({ canvas: canvasRef.current, span, originRect: containerRect, spanRect }),
      });
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [editTextMode, onEditExistingText, scale, size]);

  useEffect(() => {
    if (!textLayerRef.current || !searchQuery?.trim()) {
      textLayerRef.current
        ?.querySelectorAll("span.pdf-search-hit")
        .forEach((el) => el.classList.remove("pdf-search-hit"));
      return;
    }
    const query = searchQuery.trim().toLowerCase();
    const spans = textLayerRef.current.querySelectorAll("span");
    spans.forEach((span) => {
      if (span.textContent?.toLowerCase().includes(query)) {
        span.classList.add("pdf-search-hit");
      } else {
        span.classList.remove("pdf-search-hit");
      }
    });
  }, [searchQuery, size]);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        registerRef?.(el);
      }}
      className="relative mx-auto flex justify-center"
      style={size ? { width: size.width, height: size.height } : { minHeight: 400 }}
    >
      {!size && <Skeleton className="h-[600px] w-[460px]" />}
      <canvas ref={canvasRef} className={cn("shadow-md", !size && "hidden")} />
      <div
        ref={textLayerRef}
        className={cn(
          "pdf-text-layer pointer-events-auto absolute inset-0 select-text",
          editTextMode && "pdf-text-layer-editable"
        )}
      />
      {size && renderOverlay?.(size)}
    </div>
  );
}
