"use client";

import type { PdfDocumentProxy } from "@folio/engine";
import { Checkbox } from "@/components/ui/checkbox";

export type OcgConfig = Awaited<ReturnType<PdfDocumentProxy["getOptionalContentConfig"]>>;

type OrderEntry = string | { name?: string; order?: unknown[] };

type LayersPanelProps = {
  config: OcgConfig | null;
  onToggle: (id: string, visible: boolean) => void;
};

function renderOrder(order: unknown[], config: OcgConfig, onToggle: (id: string, visible: boolean) => void, depth: number) {
  return order.map((entry, i) => {
    const item = entry as OrderEntry;
    if (typeof item === "string") {
      const group = config.getGroup(item);
      if (!group) return null;
      return (
        <label
          key={item}
          className="hover:bg-accent flex items-center gap-2 rounded-md py-1 text-sm"
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <Checkbox
            checked={group.visible}
            onCheckedChange={(checked) => onToggle(item, checked)}
          />
          <span className="truncate">{group.name || "Layer"}</span>
        </label>
      );
    }
    if (item && typeof item === "object" && Array.isArray(item.order)) {
      return (
        <div key={i}>
          {item.name && (
            <div
              className="text-muted-foreground py-1 text-xs font-medium"
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              {item.name}
            </div>
          )}
          {renderOrder(item.order, config, onToggle, depth + 1)}
        </div>
      );
    }
    return null;
  });
}

export function LayersPanel({ config, onToggle }: LayersPanelProps) {
  if (!config) {
    return <p className="text-muted-foreground p-3 text-sm">Loading layers…</p>;
  }

  const order = config.getOrder();
  if (!order || order.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">This document has no layers.</p>;
  }

  return <div className="flex flex-col gap-0.5 p-2">{renderOrder(order, config, onToggle, 0)}</div>;
}
