"use client";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  Upload,
  ZoomIn,
  ZoomOut,
  Sidebar,
  LayoutTemplate,
  BookOpenText,
  Maximize,
  Minimize,
  Presentation,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@folio/engine";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  continuous: "Continuous scroll",
  single: "Single page",
  facing: "Facing pages",
  cover: "Cover page",
};

type PdfToolbarProps = {
  fileName: string;
  currentPage: number;
  numPages: number;
  scale: number;
  isSearchOpen: boolean;
  isSidebarOpen: boolean;
  viewMode: ViewMode;
  isFullscreen: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onPageChange: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onToggleSearch: () => void;
  onToggleSidebar: () => void;
  onOpenNewFile: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleReadingMode: () => void;
  onToggleFullscreen: () => void;
  onEnterPresentation: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
};

export function PdfToolbar({
  fileName,
  currentPage,
  numPages,
  scale,
  isSearchOpen,
  isSidebarOpen,
  viewMode,
  isFullscreen,
  canGoBack,
  canGoForward,
  onPageChange,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onToggleSearch,
  onToggleSidebar,
  onOpenNewFile,
  onViewModeChange,
  onToggleReadingMode,
  onToggleFullscreen,
  onEnterPresentation,
  onNavigateBack,
  onNavigateForward,
}: PdfToolbarProps) {
  return (
    <div className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle thumbnails"
              onClick={onToggleSidebar}
            />
          }
        >
          <Sidebar className={isSidebarOpen ? "text-primary" : ""} />
        </TooltipTrigger>
        <TooltipContent>Toggle thumbnails</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6" />

      <span className="max-w-[200px] truncate text-sm font-medium" title={fileName}>
        {fileName}
      </span>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Navigate back"
                disabled={!canGoBack}
                onClick={onNavigateBack}
              />
            }
          >
            <ArrowLeft />
          </TooltipTrigger>
          <TooltipContent>Back</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Navigate forward"
                disabled={!canGoForward}
                onClick={onNavigateForward}
              />
            }
          >
            <ArrowRight />
          </TooltipTrigger>
          <TooltipContent>Forward</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={onPrevPage}
              />
            }
          >
            <ChevronLeft />
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>
        <Input
          type="number"
          value={currentPage}
          min={1}
          max={numPages}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (!Number.isNaN(value)) onPageChange(value);
          }}
          className="h-8 w-14 text-center"
        />
        <span className="text-muted-foreground text-sm">/ {numPages}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={currentPage >= numPages}
                onClick={onNextPage}
              />
            }
          >
            <ChevronRight />
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="Zoom out" onClick={onZoomOut} />}
          >
            <ZoomOut />
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <button
          onClick={onFitWidth}
          aria-label="Reset zoom to fit width"
          className="text-muted-foreground hover:text-foreground w-14 text-center text-sm"
        >
          {Math.round(scale * 100)}%
        </button>
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="Zoom in" onClick={onZoomIn} />}
          >
            <ZoomIn />
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" aria-label="Page layout" />}
              />
            }
          >
            <LayoutTemplate />
          </TooltipTrigger>
          <TooltipContent>Page layout</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={viewMode}
            onValueChange={(value) => onViewModeChange(value as ViewMode)}
          >
            {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode} closeOnClick>
                {VIEW_MODE_LABELS[mode]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reading mode"
              onClick={onToggleReadingMode}
            />
          }
        >
          <BookOpenText />
        </TooltipTrigger>
        <TooltipContent>Reading mode</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              onClick={onToggleFullscreen}
            />
          }
        >
          {isFullscreen ? <Minimize /> : <Maximize />}
        </TooltipTrigger>
        <TooltipContent>{isFullscreen ? "Exit full screen" : "Full screen"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Presentation mode"
              onClick={onEnterPresentation}
            />
          }
        >
          <Presentation />
        </TooltipTrigger>
        <TooltipContent>Presentation mode</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Search" onClick={onToggleSearch} />
          }
        >
          <Search className={isSearchOpen ? "text-primary" : ""} />
        </TooltipTrigger>
        <TooltipContent>Search</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open another PDF"
              onClick={onOpenNewFile}
            />
          }
        >
          <Upload />
        </TooltipTrigger>
        <TooltipContent>Open another PDF</TooltipContent>
      </Tooltip>
    </div>
  );
}
