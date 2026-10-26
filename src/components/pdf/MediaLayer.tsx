"use client";

import { useEffect, useState } from "react";
import type { PdfDocumentProxy, EmbeddedMedia } from "@folio/engine";

type PositionedMedia = EmbeddedMedia & { x: number; y: number; width: number; height: number; url: string };

/** A positioned result together with the inputs it was derived from. */
type ResolvedMedia = {
  doc: PdfDocumentProxy;
  sourcePageIndex: number;
  rotation: number;
  media: EmbeddedMedia[];
  items: PositionedMedia[];
};

type MediaLayerProps = {
  doc: PdfDocumentProxy;
  sourcePageIndex: number;
  rotation: number;
  scale: number;
  media: EmbeddedMedia[];
};

export function MediaLayer({ doc, sourcePageIndex, rotation, scale, media }: MediaLayerProps) {
  // The result is stored with its inputs rather than reset when they change: blob URLs are
  // revoked on cleanup, so a stale result must not reach the DOM while the next one resolves.
  const [resolved, setResolved] = useState<ResolvedMedia | null>(null);

  useEffect(() => {
    if (media.length === 0) return;

    let cancelled = false;
    const urls: string[] = [];

    (async () => {
      const page = await doc.getPage(sourcePageIndex + 1);
      if (cancelled) return;
      const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360;
      const viewport1 = page.getViewport({ scale: 1, rotation: totalRotation });

      const items = media.map((m) => {
        const [rx1, ry1] = viewport1.convertToViewportPoint(m.rect[0], m.rect[1]);
        const [rx2, ry2] = viewport1.convertToViewportPoint(m.rect[2], m.rect[3]);
        const url = URL.createObjectURL(new Blob([m.bytes as BlobPart], { type: m.mimeType }));
        urls.push(url);
        return {
          ...m,
          x: Math.min(rx1, rx2),
          y: Math.min(ry1, ry2),
          width: Math.abs(rx2 - rx1),
          height: Math.abs(ry2 - ry1),
          url,
        };
      });

      if (!cancelled) setResolved({ doc, sourcePageIndex, rotation, media, items });
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [doc, sourcePageIndex, rotation, media]);

  const positioned =
    resolved &&
    resolved.doc === doc &&
    resolved.sourcePageIndex === sourcePageIndex &&
    resolved.rotation === rotation &&
    resolved.media === media
      ? resolved.items
      : null;

  if (!positioned || positioned.length === 0) return null;

  return (
    <>
      {positioned.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            left: m.x * scale,
            top: m.y * scale,
            width: m.width * scale,
            height: m.height * scale,
          }}
        >
          {m.kind === "video" ? (
            <video src={m.url} controls className="h-full w-full bg-black" />
          ) : (
            <audio src={m.url} controls className="w-full" />
          )}
        </div>
      ))}
    </>
  );
}
