"use client";

import { LayoutGrid, Rows3, Layers, Paperclip, MessageSquare, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SidebarPanel = "thumbnails" | "outline" | "layers" | "attachments" | "comments" | "accessibility";

const PANELS: { panel: SidebarPanel; icon: typeof LayoutGrid; label: string }[] = [
  { panel: "thumbnails", icon: LayoutGrid, label: "Thumbnails" },
  { panel: "outline", icon: Rows3, label: "Outline" },
  { panel: "layers", icon: Layers, label: "Layers" },
  { panel: "attachments", icon: Paperclip, label: "Attachments" },
  { panel: "comments", icon: MessageSquare, label: "Comments" },
  { panel: "accessibility", icon: Tags, label: "Tags (Accessibility)" },
];

type SidebarRailProps = {
  active: SidebarPanel;
  onChange: (panel: SidebarPanel) => void;
};

export function SidebarRail({ active, onChange }: SidebarRailProps) {
  return (
    <div className="bg-muted/50 flex w-11 shrink-0 flex-col items-center gap-1 border-r py-2">
      {PANELS.map(({ panel, icon: Icon, label }) => (
        <Tooltip key={panel}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                onClick={() => onChange(panel)}
                className={cn(active === panel && "bg-accent text-accent-foreground")}
              />
            }
          >
            <Icon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
