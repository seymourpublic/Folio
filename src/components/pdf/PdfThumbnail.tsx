"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfDocumentProxy } from "@folio/engine";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const THUMBNAIL_WIDTH = 120;

type PdfThumbnailProps = {
  doc: PdfDocumentProxy;
  sourcePageIndex: number;
  rotation: number;
  label: number;
  isActive: boolean;
  onClick: () => void;
};

export function PdfThumbnail({
  doc,
  sourcePageIndex,
  rotation,
  label,
  isActive,
  onClick,
}: PdfThumbnailProps) {
  const { ref: containerRef, isIntersecting } = useIntersectionObserver<HTMLButtonElement>({
    rootMargin: "400px 0px",
    sticky: false,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    if (!isIntersecting) return;
    let cancelled = false;

    (async () => {
      const page = await doc.getPage(sourcePageIndex + 1);
      if (cancelled) return;
      const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360;
      const baseViewport = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = THUMBNAIL_WIDTH / baseViewport.width;
      const viewport = page.getViewport({ scale, rotation: totalRotation });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      await renderTask.promise;
      if (cancelled) return;
      setHasRendered(true);
    })().catch((err) => console.error(`Failed to render thumbnail ${sourcePageIndex + 1}`, err));

    return () => {
      cancelled = true;
    };
  }, [doc, sourcePageIndex, rotation, isIntersecting]);

  useEffect(() => {
    if (isIntersecting) return;
    const timeout = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas && (canvas.width > 0 || canvas.height > 0)) {
        canvas.width = 0;
        canvas.height = 0;
      }
      setHasRendered(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [isIntersecting]);

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-md border-2 p-2 transition-colors",
        isActive
          ? "border-primary bg-accent"
          : "border-transparent hover:border-border hover:bg-accent/50"
      )}
    >
      {!hasRendered && <Skeleton className="h-[155px] w-[120px]" />}
      <canvas ref={canvasRef} className={cn("shadow-sm", !hasRendered && "hidden")} />
      <span className="text-muted-foreground text-xs">{label}</span>
    </button>
  );
}
