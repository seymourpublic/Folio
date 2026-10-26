"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_TOOLBAR_ORDER,
  TOOLBAR_ITEM_LABELS,
  type ToolbarItemId,
  type ToolbarLayout,
} from "@/lib/toolbar-config";

type ToolbarCustomizeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ToolbarLayout;
  onChange: (layout: ToolbarLayout) => void;
};

export function ToolbarCustomizeDialog({ open, onOpenChange, layout, onChange }: ToolbarCustomizeDialogProps) {
  function toggleVisible(id: ToolbarItemId) {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((h) => h !== id)
      : [...layout.hidden, id];
    onChange({ ...layout, hidden });
  }

  function move(id: ToolbarItemId, delta: number) {
    const index = layout.order.indexOf(id);
    const target = index + delta;
    if (target < 0 || target >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[target]] = [order[target], order[index]];
    onChange({ ...layout, order });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize toolbar</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Show, hide, and reorder the annotation toolbar. Changes apply immediately and are
          remembered on this device.
        </p>
        <div className="flex flex-col gap-1">
          {layout.order.map((id, index) => (
            <div key={id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <Checkbox
                id={`toolbar-item-${id}`}
                checked={!layout.hidden.includes(id)}
                onCheckedChange={() => toggleVisible(id)}
              />
              <label htmlFor={`toolbar-item-${id}`} className="flex-1 text-sm font-normal">
                {TOOLBAR_ITEM_LABELS[id]}
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Move ${TOOLBAR_ITEM_LABELS[id]} up`}
                disabled={index === 0}
                onClick={() => move(id, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Move ${TOOLBAR_ITEM_LABELS[id]} down`}
                disabled={index === layout.order.length - 1}
                onClick={() => move(id, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onChange({ order: DEFAULT_TOOLBAR_ORDER, hidden: [] })}>
            Reset to default
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

