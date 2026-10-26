"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorDocument } from "@/hooks/useEditorDocument";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";
import { PdfToolbar } from "./PdfToolbar";
import { PdfThumbnail } from "./PdfThumbnail";
import { PdfPageCanvas, type EditableTextRun } from "./PdfPageCanvas";
import { readRunStyle } from "@/lib/pdf/run-appearance";
import { PdfSearchPanel } from "./PdfSearchPanel";
import { AnnotationLayer, type PendingImage, type PendingStamp } from "./AnnotationLayer";
import { AnnotationInspector, isInspectable } from "./AnnotationInspector";
import { ImageEditDialog } from "./ImageEditDialog";
import { FormFieldPropertiesDialog } from "./FormFieldPropertiesDialog";
import { FormDataDialog } from "./FormDataDialog";
import { CompressDialog } from "./CompressDialog";
import { ExportDialog } from "./ExportDialog";
import { FormFieldLayer } from "./FormFieldLayer";
import { MediaLayer } from "./MediaLayer";
import {
  EditToolbar,
  FORM_LABEL,
  FORM_TOOLS,
  MARKUP_LABEL,
  MARKUP_TOOLS,
  SHAPE_LABEL,
  SHAPE_TOOLS,
  TOOLS,
} from "./EditToolbar";
import { CommandPalette } from "./CommandPalette";
import { ModeTabs, type DocMode } from "./ModeTabs";
import { OrganizePagesView } from "./OrganizePagesView";
import { ComparePagesView } from "./ComparePagesView";
import { SignatureDialog } from "./SignatureDialog";
import { WatermarkDialog } from "./WatermarkDialog";
import { PasswordDialog } from "./PasswordDialog";
import { OpenPasswordPrompt } from "./OpenPasswordPrompt";
import { MetadataDialog } from "./MetadataDialog";
import { BookmarksDialog } from "./BookmarksDialog";
import { PageNumbersDialog } from "./PageNumbersDialog";
import { SplitDialog } from "./SplitDialog";
import { PropertiesDialog } from "./PropertiesDialog";
import { SidebarRail, type SidebarPanel } from "./SidebarRail";
import { OutlinePanel } from "./OutlinePanel";
import { LayersPanel, type OcgConfig } from "./LayersPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { CommentsPanel } from "./CommentsPanel";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { SecurityCenterDialog } from "./SecurityCenterDialog";
import { BarcodeScanDialog } from "./BarcodeScanDialog";
import { CertificateSignDialog } from "./CertificateSignDialog";
import { BulkSignDialog } from "./BulkSignDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createId,
  getPageText,
  searchEverything,
  type Annotation,
  type DocPage,
  type ImageAnnotation,
  type Tool,
  type ViewMode,
  type FormFieldDef,
  type EmbeddedMedia,
  type MeasurementUnit,
} from "@folio/engine";
import { verifyPdfSignatures, type SignatureVerification } from "@folio/engine/signing";
import { loadEnabledPluginManifests, type PluginApi } from "@/lib/plugins/plugin-runtime";
import { saveOrDownloadPdf } from "@/lib/electron-bridge";
import { logAuditEvent } from "@/lib/pdf/audit-log";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Command } from "@/lib/commands/types";
import { SHORTCUTS } from "@/lib/commands/shortcut-manifest";
import { getDefaultViewMode } from "@/lib/app-settings";

const EMPTY_MEDIA: EmbeddedMedia[] = [];

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;

type PdfViewerProps = {
  file: File;
  additionalFiles?: File[];
  restoreId?: string;
  isActive?: boolean;
  onOpenNewFile: () => void;
  /** Workspace-level actions, folded into this tab's command palette and shortcuts. */
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onToggleSplit?: () => void;
  canToggleSplit?: boolean;
  onNewWindow?: () => void;
  /** Notifies Workspace so the app's outer chrome hides too, not just this pane. */
  onReadingModeChange?: (active: boolean) => void;
};

function getSpreads(pages: DocPage[], mode: ViewMode): DocPage[][] {
  if (mode === "continuous" || mode === "single") return pages.map((p) => [p]);
  if (mode === "cover") {
    const spreads: DocPage[][] = [];
    if (pages[0]) spreads.push([pages[0]]);
    for (let i = 1; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));
    return spreads;
  }
  const spreads: DocPage[][] = [];
  for (let i = 0; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));
  return spreads;
}

export function PdfViewer({
  file,
  additionalFiles,
  restoreId,
  isActive = true,
  onOpenNewFile,
  onNewTab,
  onCloseTab,
  onToggleSplit,
  canToggleSplit,
  onNewWindow,
  onReadingModeChange,
}: PdfViewerProps) {
  const editor = useEditorDocument();
  const {
    fileName,
    pages,
    sources,
    pdfjsDocs,
    isReady,
    loadInitialFile,
    restoreFromAutosave,
    addFileAtEnd,
    reorderPages,
    rotatePage,
    deletePage,
    duplicatePage,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setFormFieldValue,
    exportAndDownload,
    exportCurrentBytes,
    scrubAndDownload,
    secureShareDownload,
    exportCompressedCopy,
    exportPageSvg,
    extractAndDownload,
    watermark,
    setWatermark,
    encryption,
    setEncryption,
    ocrProgress,
    ocrResult,
    clearOcrResult,
    runOcrAll,
    passwordPrompt,
    retryWithPassword,
    cancelPasswordPrompt,
    metadata,
    setMetadata,
    bookmarks,
    setBookmarks,
    pageNumbering,
    setPageNumbering,
    splitDocument,
    wasSourceEncrypted,
    saveUnlockedCopy,
    mediaBySource,
    documentId,
  } = editor;

  const [scale, setScale] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#fde047");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingStamp, setPendingStamp] = useState<PendingStamp | null>(null);
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("in");
  const [selection, setSelection] = useState<{ pageId: string; annotationId: string } | null>(null);
  const [editing, setEditing] = useState<{ pageId: string; annotationId: string } | null>(null);
  const [mode, setMode] = useState<DocMode>("view");
  const [formsSubMode, setFormsSubMode] = useState<"create" | "fill">("fill");
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isWatermarkOpen, setIsWatermarkOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isPageNumbersOpen, setIsPageNumbersOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isCompressOpen, setIsCompressOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [isSecurityCenterOpen, setIsSecurityCenterOpen] = useState(false);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const [isFieldPropertiesOpen, setIsFieldPropertiesOpen] = useState(false);
  const [signatureFieldTarget, setSignatureFieldTarget] = useState<{ pageId: string; field: FormFieldDef } | null>(null);
  const [isFormDataOpen, setIsFormDataOpen] = useState(false);
  const [isCertSignOpen, setIsCertSignOpen] = useState(false);
  const [isBulkSignOpen, setIsBulkSignOpen] = useState(false);
  const [signatureVerifications, setSignatureVerifications] = useState<SignatureVerification[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getDefaultViewMode());
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentationScale, setPresentationScale] = useState(1);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("thumbnails");
  const [ocgConfig, setOcgConfig] = useState<OcgConfig | null>(null);
  const [ocgVersion, setOcgVersion] = useState(0);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteSearchHits, setPaletteSearchHits] = useState<Command[]>([]);
  const paletteSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paletteSearchRequestId = useRef(0);
  const [pluginCommands, setPluginCommands] = useState<Command[]>([]);

  useEffect(() => {
    if (!isPaletteOpen) return;
    let cancelled = false;
    loadEnabledPluginManifests().then((results) => {
      if (cancelled) return;
      const cmds: Command[] = [];
      for (const { plugin, manifest, error } of results) {
        if (!manifest) {
          console.error(`Plugin "${plugin.name}" failed to load: ${error}`);
          continue;
        }
        for (const c of manifest.commands) {
          cmds.push({
            id: `plugin:${manifest.id}:${c.id}`,
            title: c.title,
            category: "plugin",
            run: () => {
              Promise.resolve(c.run(buildPluginApiRef.current())).catch((err) => {
                window.alert(`Plugin "${manifest.name}" error: ${err instanceof Error ? err.message : String(err)}`);
              });
            },
          });
        }
      }
      setPluginCommands(cmds);
    });
    return () => {
      cancelled = true;
    };
  }, [isPaletteOpen]);

  function buildPluginApi(): PluginApi {
    const getPageTextByIndex = async (pageIndex: number): Promise<string> => {
      const docPage = pages[pageIndex];
      if (!docPage) return "";
      const doc = pdfjsDocs.get(docPage.sourceId);
      if (!doc) return "";
      return getPageText(doc, docPage.sourceId, docPage.sourcePageIndex);
    };
    return {
      getPageCount: () => pages.length,
      getCurrentPageIndex: () => Math.max(0, pages.findIndex((p) => p.id === currentPageId)),
      getPageText: getPageTextByIndex,
      getAllPagesText: () => Promise.all(pages.map((_, i) => getPageTextByIndex(i))),
      addTextAnnotation: (pageIndex, opts) => {
        const docPage = pages[pageIndex];
        if (!docPage) return;
        addAnnotation(docPage.id, {
          id: createId(),
          type: "text",
          x: opts.x,
          y: opts.y,
          text: opts.text,
          fontSize: opts.fontSize ?? 14,
          color: opts.color ?? "#000000",
        });
      },
      addNoteAnnotation: (pageIndex, opts) => {
        const docPage = pages[pageIndex];
        if (!docPage) return;
        addAnnotation(docPage.id, {
          id: createId(),
          type: "note",
          x: opts.x,
          y: opts.y,
          text: opts.text,
          color: opts.color ?? "#fde68a",
        });
      },
      showMessage: (message) => window.alert(message),
      prompt: (message, defaultValue) => window.prompt(message, defaultValue),
    };
  }

  const buildPluginApiRef = useRef(buildPluginApi);
  buildPluginApiRef.current = buildPluginApi;

  const currentPageId =
    selectedPageId && pages.some((p) => p.id === selectedPageId) ? selectedPageId : (pages[0]?.id ?? null);

  const pageRefs = useRef(new Map<string, HTMLDivElement>());
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const initializedWidthFit = useRef(false);
  const loadedFileRef = useRef<File | null>(null);
  const historyInitialized = useRef(false);

  function scrollToPage(pageId: string) {
    if (viewMode === "continuous") {
      pageRefs.current.get(pageId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSelectedPageId(pageId);
  }

  const navHistory = useNavigationHistory(scrollToPage);

  function jumpToPage(pageId: string) {
    navHistory.push(pageId);
    scrollToPage(pageId);
  }

  useEffect(() => {
    if (historyInitialized.current || !currentPageId) return;
    historyInitialized.current = true;
    navHistory.push(currentPageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId]);

  useEffect(() => {
    if (loadedFileRef.current === file) return;
    loadedFileRef.current = file;

    (async () => {
      if (restoreId) {
        await restoreFromAutosave(restoreId);
        return;
      }
      await loadInitialFile(file);
      for (const extra of additionalFiles ?? []) {
        await addFileAtEnd(extra);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (!isReady || initializedWidthFit.current || pages.length === 0) return;
    initializedWidthFit.current = true;
    fitToWidth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pages.length]);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (initializedWidthFit.current) fitToWidth();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      const active = document.fullscreenElement != null;
      setIsFullscreen(active);
      if (!active) setIsPresenting(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isReadingMode) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsReadingMode(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isReadingMode]);

  useEffect(() => {
    onReadingModeChange?.(isReadingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadingMode]);

  const currentPageIndex = currentPageId ? pages.findIndex((p) => p.id === currentPageId) : -1;

  const primarySourceId = pages[0]?.sourceId;
  const primaryDoc = primarySourceId ? pdfjsDocs.get(primarySourceId) : undefined;

  useEffect(() => {
    if (!primaryDoc) return;
    let cancelled = false;
    primaryDoc.getOptionalContentConfig().then((config) => {
      if (!cancelled) setOcgConfig(config);
    });
    return () => {
      cancelled = true;
    };
  }, [primaryDoc]);

  useEffect(() => {
    let cancelled = false;
    const primarySource = primarySourceId ? sources.get(primarySourceId) : undefined;
    const task = primarySource
      ? verifyPdfSignatures(
          primarySource.bytes instanceof Uint8Array ? primarySource.bytes : new Uint8Array(primarySource.bytes)
        )
      : Promise.resolve<SignatureVerification[]>([]);
    task
      .then((results) => {
        if (!cancelled) setSignatureVerifications(results);
      })
      .catch(() => {
        if (!cancelled) setSignatureVerifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [primarySourceId, sources]);

  const [prevSelection, setPrevSelection] = useState(selection);
  if (selection !== prevSelection) {
    setPrevSelection(selection);
    if (selection && isSidebarOpen) {
      const page = pages.find((p) => p.id === selection.pageId);
      const annotation = page?.annotations.find((a) => a.id === selection.annotationId);
      if (annotation && annotation.type !== "form-field" && annotation.type !== "form-field-create") {
        setSidebarPanel("comments");
      }
    }
  }

  function handleToggleLayer(id: string, visible: boolean) {
    ocgConfig?.setVisibility(id, visible);
    setOcgVersion((v) => v + 1);
  }

  useEffect(() => {
    if (!isPresenting) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        exitPresentation();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advancePresentation(1);
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        advancePresentation(-1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresenting, currentPageIndex, pages]);

  useEffect(() => {
    if (!isPresenting) return;
    let cancelled = false;

    async function recalc() {
      const docPage = pages[currentPageIndex];
      const doc = docPage && pdfjsDocs.get(docPage.sourceId);
      if (!doc || !docPage) return;
      const page = await doc.getPage(docPage.sourcePageIndex + 1);
      if (cancelled) return;
      const totalRotation = (((page.rotate + docPage.rotation) % 360) + 360) % 360;
      const viewport = page.getViewport({ scale: 1, rotation: totalRotation });
      const availW = window.innerWidth - 64;
      const availH = window.innerHeight - 64;
      setPresentationScale(Math.min(availW / viewport.width, availH / viewport.height));
    }

    recalc();
    window.addEventListener("resize", recalc);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", recalc);
    };
  }, [isPresenting, currentPageIndex, pages, pdfjsDocs]);

  async function fitToWidth() {
    const docPage = pages[0];
    const doc = docPage && pdfjsDocs.get(docPage.sourceId);
    if (!doc || !mainScrollRef.current) return;
    const page = await doc.getPage(docPage.sourcePageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = mainScrollRef.current.clientWidth - 48;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, containerWidth / viewport.width));
    setScale(nextScale);
  }

  function handlePageNumberChange(pageNumber: number) {
    const clamped = Math.min(Math.max(1, pageNumber), pages.length);
    const target = pages[clamped - 1];
    if (target) jumpToPage(target.id);
  }

  function stepPage(delta: number) {
    const target = pages[currentPageIndex + delta];
    if (target) scrollToPage(target.id);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  async function enterPresentation() {
    setIsPresenting(true);
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function exitPresentation() {
    setIsPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function advancePresentation(delta: number) {
    const next = pages[currentPageIndex + delta];
    if (next) setSelectedPageId(next.id);
  }

  const pageOptions = useMemo(
    () => pages.map((p, i) => ({ id: p.id, label: `Page ${i + 1}` })),
    [pages]
  );

  const selectedAnnotation: Annotation | null = useMemo(() => {
    if (!selection) return null;
    const page = pages.find((p) => p.id === selection.pageId);
    return page?.annotations.find((a) => a.id === selection.annotationId) ?? null;
  }, [pages, selection]);

  function updateSelectedAnnotation(patch: Partial<Annotation>) {
    if (!selection) return;
    updateAnnotation(selection.pageId, selection.annotationId, patch);
  }

  function handleEditExistingText(pageId: string, run: EditableTextRun) {
    const id = createId();
    addAnnotation(pageId, {
      id,
      type: "text-edit",
      x: run.x,
      y: run.y,
      width: run.width,
      height: run.height,
      originalText: run.text,
      newText: run.text,
      fontSize: run.fontSize,
      color: run.appearance?.ink ?? "#000000",
      backgroundColor: run.appearance?.background,
      fontFamily: run.font.family,
      bold: run.font.bold,
      italic: run.font.italic,
    });
    setSelection({ pageId, annotationId: id });
    setEditing({ pageId, annotationId: id });
  }

  function substituteCaseInsensitive(haystack: string, needle: string, replacement: string): string {
    const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) return haystack;
    return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
  }

  /**
   * Finds the first not-yet-replaced text-layer span on `pageId` containing `query` and covers it with a text-edit annotation.
   */
  async function replaceFirstMatchOnPage(pageId: string, query: string, replacement: string): Promise<boolean> {
    jumpToPage(pageId);
    const lowerQuery = query.toLowerCase();

    for (let attempt = 0; attempt < 30; attempt++) {
      const container = pageRefs.current.get(pageId);
      const textLayer = container?.querySelector<HTMLDivElement>(".pdf-text-layer");
      const spans = textLayer ? Array.from(textLayer.querySelectorAll<HTMLSpanElement>("span")) : [];
      const match = spans.find(
        (span) => !span.dataset.frReplaced && (span.textContent ?? "").toLowerCase().includes(lowerQuery)
      );
      if (match) {
        const text = match.textContent ?? "";
        const containerRect = container!.getBoundingClientRect();
        const spanRect = match.getBoundingClientRect();
        const fontSizePx = parseFloat(getComputedStyle(match).fontSize) || 12 * scale;
        match.dataset.frReplaced = "1";
        const style = readRunStyle({
          canvas: container!.querySelector("canvas"),
          span: match,
          originRect: containerRect,
          spanRect,
        });
        addAnnotation(pageId, {
          id: createId(),
          type: "text-edit",
          x: (spanRect.left - containerRect.left) / scale,
          y: (spanRect.top - containerRect.top) / scale,
          width: spanRect.width / scale,
          height: spanRect.height / scale,
          originalText: text,
          newText: substituteCaseInsensitive(text, query, replacement),
          fontSize: fontSizePx / scale,
          color: style.appearance?.ink ?? "#000000",
          backgroundColor: style.appearance?.background,
          fontFamily: style.font.family,
          bold: style.font.bold,
          italic: style.font.italic,
        });
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  const otherFieldNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of pages) {
      for (const a of p.annotations) {
        if (a.type === "form-field-create" && a.id !== selectedAnnotation?.id) names.add(a.fieldName);
      }
    }
    return Array.from(names);
  }, [pages, selectedAnnotation?.id]);

  const mediaByPageId = useMemo(() => {
    const map = new Map<string, EmbeddedMedia[]>();
    for (const docPage of pages) {
      const sourceMedia = mediaBySource.get(docPage.sourceId);
      if (!sourceMedia) continue;
      const forThisPage = sourceMedia.filter((m) => m.pageIndex === docPage.sourcePageIndex);
      if (forThisPage.length) map.set(docPage.id, forThisPage);
    }
    return map;
  }, [pages, mediaBySource]);

  const spreads = useMemo(() => getSpreads(pages, viewMode), [pages, viewMode]);
  const currentSpreadIndex = useMemo(() => {
    if (viewMode === "continuous") return -1;
    const idx = spreads.findIndex((spread) => spread.some((p) => p.id === currentPageId));
    return idx === -1 ? 0 : idx;
  }, [spreads, currentPageId, viewMode]);

  function openPanel(panel: SidebarPanel) {
    setIsSidebarOpen(true);
    setSidebarPanel(panel);
  }

  function handlePaletteQueryChange(query: string) {
    if (paletteSearchDebounce.current) clearTimeout(paletteSearchDebounce.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setPaletteSearchHits([]);
      return;
    }
    const requestId = ++paletteSearchRequestId.current;
    paletteSearchDebounce.current = setTimeout(() => {
      searchEverything(pages, pdfjsDocs, metadata, bookmarks, trimmed).then((matches) => {
        if (paletteSearchRequestId.current !== requestId) return;
        setPaletteSearchHits(
          matches.map((m) => ({
            id: m.id,
            title: `${m.title}: ${m.snippet}`,
            category: "search-hit",
            run: () => {
              if (m.pageId) {
                jumpToPage(m.pageId);
                if (m.kind === "annotation") openPanel("comments");
              }
            },
          }))
        );
      });
    }, 200);
  }

  const commands: Command[] = [
    {
      id: "palette",
      title: "Open command palette",
      category: "navigation",
      shortcut: SHORTCUTS.commandPalette,
      run: () => setIsPaletteOpen(true),
    },
    {
      id: "nav-prev-page",
      title: "Previous page",
      category: "navigation",
      shortcut: SHORTCUTS.prevPage,
      disabled: currentPageIndex <= 0,
      run: () => stepPage(-1),
    },
    {
      id: "nav-next-page",
      title: "Next page",
      category: "navigation",
      shortcut: SHORTCUTS.nextPage,
      disabled: currentPageIndex >= pages.length - 1,
      run: () => stepPage(1),
    },
    {
      id: "nav-first-page",
      title: "First page",
      category: "navigation",
      shortcut: SHORTCUTS.firstPage,
      run: () => pages[0] && jumpToPage(pages[0].id),
    },
    {
      id: "nav-last-page",
      title: "Last page",
      category: "navigation",
      shortcut: SHORTCUTS.lastPage,
      run: () => pages[pages.length - 1] && jumpToPage(pages[pages.length - 1].id),
    },
    {
      id: "nav-back",
      title: "Go back",
      category: "navigation",
      shortcut: SHORTCUTS.goBack,
      disabled: !navHistory.canGoBack,
      run: navHistory.back,
    },
    {
      id: "nav-forward",
      title: "Go forward",
      category: "navigation",
      shortcut: SHORTCUTS.goForward,
      disabled: !navHistory.canGoForward,
      run: navHistory.forward,
    },
    {
      id: "view-zoom-in",
      title: "Zoom in",
      category: "view",
      shortcut: SHORTCUTS.zoomIn,
      run: () => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP)),
    },
    {
      id: "view-zoom-out",
      title: "Zoom out",
      category: "view",
      shortcut: SHORTCUTS.zoomOut,
      run: () => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP)),
    },
    { id: "view-fit-width", title: "Zoom to fit width", category: "view", shortcut: SHORTCUTS.fitWidth, run: fitToWidth },
    {
      id: "view-toggle-sidebar",
      title: isSidebarOpen ? "Hide sidebar" : "Show sidebar",
      category: "view",
      shortcut: SHORTCUTS.toggleSidebar,
      run: () => setIsSidebarOpen((v) => !v),
    },
    {
      id: "view-toggle-search",
      title: isSearchOpen ? "Close search" : "Search in document",
      category: "view",
      shortcut: SHORTCUTS.search,
      run: () => setIsSearchOpen((v) => !v),
    },
    {
      id: "view-toggle-reading-mode",
      title: isReadingMode ? "Exit reading mode" : "Reading mode",
      category: "view",
      run: () => setIsReadingMode((v) => !v),
    },
    {
      id: "view-toggle-fullscreen",
      title: isFullscreen ? "Exit full screen" : "Full screen",
      category: "view",
      run: toggleFullscreen,
    },
    { id: "view-presentation", title: "Presentation mode", category: "view", run: enterPresentation },
    ...(["continuous", "single", "facing", "cover"] as ViewMode[]).map((mode) => ({
      id: `view-mode-${mode}`,
      title: `Layout: ${
        { continuous: "Continuous scroll", single: "Single page", facing: "Facing pages", cover: "Cover page" }[mode]
      }`,
      category: "view" as const,
      run: () => setViewMode(mode),
    })),
    ...(["view", "annotate", "organize", "forms", "compare"] as DocMode[]).map((m) => ({
      id: `doc-mode-${m}`,
      title: `Mode: ${m[0].toUpperCase()}${m.slice(1)}`,
      category: "view" as const,
      run: () => setMode(m),
    })),
    {
      id: "panel-thumbnails",
      title: "Show thumbnails panel",
      category: "panel",
      run: () => openPanel("thumbnails"),
    },
    { id: "panel-outline", title: "Show outline panel", category: "panel", run: () => openPanel("outline") },
    { id: "panel-layers", title: "Show layers panel", category: "panel", run: () => openPanel("layers") },
    {
      id: "panel-attachments",
      title: "Show attachments panel",
      category: "panel",
      run: () => openPanel("attachments"),
    },
    { id: "panel-comments", title: "Show comments panel", category: "panel", run: () => openPanel("comments") },
    {
      id: "panel-accessibility",
      title: "Show tags (accessibility) panel",
      category: "panel",
      run: () => openPanel("accessibility"),
    },
    {
      id: "tool-select",
      title: "Tool: Select & move",
      category: "tool",
      run: () => setTool("select"),
    },
    ...TOOLS.map(({ tool: t, label }) => ({
      id: `tool-${t}`,
      title: `Tool: ${label}`,
      category: "tool" as const,
      run: () => setTool(t),
    })),
    ...MARKUP_TOOLS.map((t) => ({
      id: `tool-${t}`,
      title: `Tool: ${MARKUP_LABEL[t]}`,
      category: "tool" as const,
      run: () => setTool(t),
    })),
    ...SHAPE_TOOLS.map((t) => ({
      id: `tool-${t}`,
      title: `Tool: ${SHAPE_LABEL[t]}`,
      category: "tool" as const,
      run: () => setTool(t),
    })),
    ...FORM_TOOLS.map((t) => ({
      id: `tool-${t}`,
      title: `Tool: ${FORM_LABEL[t]}`,
      category: "tool" as const,
      run: () => setTool(t),
    })),
    { id: "doc-organize", title: "Organize pages", category: "document", run: () => setMode("organize") },
    { id: "doc-download", title: "Download PDF", category: "document", shortcut: SHORTCUTS.download, run: exportAndDownload },
    { id: "doc-export-as", title: "Export as… (Word, PowerPoint, Excel, EPUB, …)", category: "document", run: () => setIsExportOpen(true) },
    { id: "doc-sign", title: "Sign document", category: "document", run: () => setIsSignatureOpen(true) },
    { id: "doc-watermark", title: "Add watermark…", category: "document", run: () => setIsWatermarkOpen(true) },
    encryption
      ? { id: "doc-unlock", title: "Remove password…", category: "document", run: () => setEncryption(null) }
      : { id: "doc-password", title: "Password protect…", category: "document", run: () => setIsPasswordOpen(true) },
    { id: "doc-metadata", title: "Edit document metadata…", category: "document", run: () => setIsMetadataOpen(true) },
    { id: "doc-properties", title: "Document properties…", category: "document", run: () => setIsPropertiesOpen(true) },
    {
      id: "doc-page-numbers",
      title: "Page numbers & header/footer…",
      category: "document",
      run: () => setIsPageNumbersOpen(true),
    },
    { id: "doc-bookmarks", title: "Edit bookmarks…", category: "document", run: () => setIsBookmarksOpen(true) },
    { id: "doc-split", title: "Split document…", category: "document", run: () => setIsSplitOpen(true) },
    { id: "doc-compress", title: "Compress document…", category: "document", run: () => setIsCompressOpen(true) },
    {
      id: "doc-export-svg",
      title: "Export current page as SVG",
      category: "document",
      disabled: !currentPageId,
      run: () => currentPageId && exportPageSvg(currentPageId),
    },
    {
      id: "doc-cert-sign",
      title: "Sign with certificate…",
      category: "document",
      run: () => setIsCertSignOpen(true),
    },
    { id: "doc-bulk-sign", title: "Bulk sign multiple files…", category: "document", run: () => setIsBulkSignOpen(true) },
    {
      id: "doc-security-center",
      title: "Security center…",
      category: "document",
      run: () => setIsSecurityCenterOpen(true),
    },
    { id: "doc-form-data", title: "Form data…", category: "document", run: () => setIsFormDataOpen(true) },
    {
      id: "doc-run-ocr",
      title: "Make searchable (run OCR)",
      category: "document",
      disabled: ocrProgress !== null,
      run: runOcrAll,
    },
    {
      id: "doc-scan-barcodes",
      title: "Scan for barcodes & QR codes",
      category: "document",
      run: () => setIsBarcodeScanOpen(true),
    },
    { id: "file-open", title: "Open another PDF…", category: "file", run: onOpenNewFile },
    {
      id: "file-new-tab",
      title: "Open new tab…",
      category: "file",
      shortcut: SHORTCUTS.newTab,
      disabled: !onNewTab,
      run: () => onNewTab?.(),
    },
    {
      id: "file-close-tab",
      title: "Close tab",
      category: "file",
      shortcut: SHORTCUTS.closeTab,
      disabled: !onCloseTab,
      run: () => onCloseTab?.(),
    },
    {
      id: "file-toggle-split",
      title: "Toggle split view",
      category: "file",
      disabled: !onToggleSplit || !canToggleSplit,
      run: () => onToggleSplit?.(),
    },
    ...(onNewWindow
      ? [{ id: "file-new-window", title: "New window", category: "file" as const, run: onNewWindow }]
      : []),
    ...pluginCommands,
  ];

  useKeyboardShortcuts(commands, isActive);

  if (passwordPrompt) {
    return (
      <OpenPasswordPrompt
        wasIncorrect={passwordPrompt.wasIncorrect}
        onSubmit={retryWithPassword}
        onCancel={() => {
          cancelPasswordPrompt();
          onOpenNewFile();
        }}
      />
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading document…</p>
      </div>
    );
  }

  if (mode === "organize") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PdfToolbar
          fileName={fileName}
          currentPage={currentPageIndex + 1}
          numPages={pages.length}
          scale={scale}
          isSearchOpen={isSearchOpen}
          isSidebarOpen={isSidebarOpen}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          canGoBack={navHistory.canGoBack}
          canGoForward={navHistory.canGoForward}
          onPageChange={handlePageNumberChange}
          onPrevPage={() => stepPage(-1)}
          onNextPage={() => stepPage(1)}
          onZoomIn={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
          onZoomOut={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
          onFitWidth={fitToWidth}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          onOpenNewFile={onOpenNewFile}
          onViewModeChange={setViewMode}
          onToggleReadingMode={() => setIsReadingMode(true)}
          onToggleFullscreen={toggleFullscreen}
          onEnterPresentation={enterPresentation}
          onNavigateBack={navHistory.back}
          onNavigateForward={navHistory.forward}
        />
        <div className="bg-background flex h-11 shrink-0 items-center gap-1 border-b px-3">
          <ModeTabs mode={mode} onModeChange={setMode} />
        </div>
        <OrganizePagesView
          pages={pages}
          pdfjsDocs={pdfjsDocs}
          onReorder={reorderPages}
          onRotate={rotatePage}
          onDelete={deletePage}
          onDuplicate={duplicatePage}
          onAddFile={addFileAtEnd}
          onExtract={(ids) => extractAndDownload(ids)}
          onClose={() => setMode("view")}
        />
        <CommandPalette
          open={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
          commands={commands}
          onQueryChange={handlePaletteQueryChange}
          searchHits={paletteSearchHits}
        />
      </div>
    );
  }

  if (mode === "compare") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PdfToolbar
          fileName={fileName}
          currentPage={currentPageIndex + 1}
          numPages={pages.length}
          scale={scale}
          isSearchOpen={isSearchOpen}
          isSidebarOpen={isSidebarOpen}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          canGoBack={navHistory.canGoBack}
          canGoForward={navHistory.canGoForward}
          onPageChange={handlePageNumberChange}
          onPrevPage={() => stepPage(-1)}
          onNextPage={() => stepPage(1)}
          onZoomIn={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
          onZoomOut={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
          onFitWidth={fitToWidth}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          onOpenNewFile={onOpenNewFile}
          onViewModeChange={setViewMode}
          onToggleReadingMode={() => setIsReadingMode(true)}
          onToggleFullscreen={toggleFullscreen}
          onEnterPresentation={enterPresentation}
          onNavigateBack={navHistory.back}
          onNavigateForward={navHistory.forward}
        />
        <div className="bg-background flex h-11 shrink-0 items-center gap-1 border-b px-3">
          <ModeTabs mode={mode} onModeChange={setMode} />
        </div>
        <ComparePagesView fileName={fileName} pages={pages} pdfjsDocs={pdfjsDocs} onClose={() => setMode("view")} />
        <CommandPalette
          open={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
          commands={commands}
          onQueryChange={handlePaletteQueryChange}
          searchHits={paletteSearchHits}
        />
      </div>
    );
  }

  if (isPresenting) {
    const docPage = pages[currentPageIndex];
    const doc = docPage && pdfjsDocs.get(docPage.sourceId);
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        onClick={() => advancePresentation(1)}
      >
        {doc && docPage && (
          <div onClick={(e) => e.stopPropagation()}>
            <PdfPageCanvas
              key={docPage.id}
              doc={doc}
              sourcePageIndex={docPage.sourcePageIndex}
              rotation={docPage.rotation}
              scale={presentationScale}
              optionalContentConfig={ocgConfig}
              layersVersion={ocgVersion}
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Exit presentation mode"
          onClick={(e) => {
            e.stopPropagation();
            exitPresentation();
          }}
          className="fixed top-4 right-4 z-50 text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  const visibleSpreads =
    viewMode === "continuous" ? spreads : spreads.slice(currentSpreadIndex, currentSpreadIndex + 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!isReadingMode && (
        <PdfToolbar
          fileName={fileName}
          currentPage={currentPageIndex + 1}
          numPages={pages.length}
          scale={scale}
          isSearchOpen={isSearchOpen}
          isSidebarOpen={isSidebarOpen}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          canGoBack={navHistory.canGoBack}
          canGoForward={navHistory.canGoForward}
          onPageChange={handlePageNumberChange}
          onPrevPage={() => stepPage(-1)}
          onNextPage={() => stepPage(1)}
          onZoomIn={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
          onZoomOut={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
          onFitWidth={fitToWidth}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          onOpenNewFile={onOpenNewFile}
          onViewModeChange={setViewMode}
          onToggleReadingMode={() => setIsReadingMode(true)}
          onToggleFullscreen={toggleFullscreen}
          onEnterPresentation={enterPresentation}
          onNavigateBack={navHistory.back}
          onNavigateForward={navHistory.forward}
        />
      )}
      {!isReadingMode && (
        <div className="bg-background flex h-11 shrink-0 items-center gap-1 border-b px-3">
          <ModeTabs mode={mode} onModeChange={setMode} />
        </div>
      )}
      {!isReadingMode && (
        <EditToolbar
          tool={tool}
          color={color}
          mode={mode}
          formsSubMode={formsSubMode}
          onFormsSubModeChange={setFormsSubMode}
          measurementUnit={measurementUnit}
          onMeasurementUnitChange={setMeasurementUnit}
          onToolChange={(t) => {
            setTool(t);
            setSelection(null);
          }}
          onColorChange={setColor}
          onImageChosen={(dataUrl, width, height) => {
            setPendingImage({ dataUrl, width, height });
            setTool("image");
          }}
          onStampChosen={(stamp) => {
            setPendingStamp(stamp);
            setTool("stamp");
          }}
          onDownload={exportAndDownload}
          onOpenSignature={() => setIsSignatureOpen(true)}
          onOpenWatermark={() => setIsWatermarkOpen(true)}
          onOpenPassword={() => setIsPasswordOpen(true)}
          onOpenMetadata={() => setIsMetadataOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenProperties={() => setIsPropertiesOpen(true)}
          onOpenPageNumbers={() => setIsPageNumbersOpen(true)}
          onOpenBookmarks={() => setIsBookmarksOpen(true)}
          onOpenSplit={() => setIsSplitOpen(true)}
          onOpenCompress={() => setIsCompressOpen(true)}
          onExportSvg={() => currentPageId && exportPageSvg(currentPageId)}
          onOpenCertificateSign={() => setIsCertSignOpen(true)}
          onOpenBulkSign={() => setIsBulkSignOpen(true)}
          onOpenSecurityCenter={() => setIsSecurityCenterOpen(true)}
          onOpenFormData={() => setIsFormDataOpen(true)}
          onRunOcr={runOcrAll}
          isOcrRunning={ocrProgress !== null}
          isEncrypted={encryption !== null}
          onUnlock={() => setEncryption(null)}
        />
      )}
      {!isReadingMode && selectedAnnotation && isInspectable(selectedAnnotation) && (
        <AnnotationInspector
          annotation={selectedAnnotation}
          onUpdate={updateSelectedAnnotation}
          onOpenImageEdit={() => setIsImageEditOpen(true)}
          onReplaceImage={(dataUrl) => updateSelectedAnnotation({ dataUrl, crop: undefined } as Partial<ImageAnnotation>)}
          onOpenFieldProperties={() => setIsFieldPropertiesOpen(true)}
        />
      )}
      <FormFieldPropertiesDialog
        key={selectedAnnotation?.id ?? "none"}
        open={isFieldPropertiesOpen}
        onOpenChange={setIsFieldPropertiesOpen}
        annotation={selectedAnnotation?.type === "form-field-create" ? selectedAnnotation : null}
        onUpdate={(patch) => updateSelectedAnnotation(patch)}
        otherFieldNames={otherFieldNames}
      />
      <FormDataDialog
        open={isFormDataOpen}
        onOpenChange={setIsFormDataOpen}
        pages={pages}
        pdfjsDocs={pdfjsDocs}
        fileName={fileName}
        onFieldChange={(pageId, field, value) => setFormFieldValue(pageId, field, value)}
      />
      <ImageEditDialog
        key={`${selectedAnnotation?.id ?? "none"}-${isImageEditOpen}`}
        open={isImageEditOpen}
        onOpenChange={setIsImageEditOpen}
        annotation={selectedAnnotation?.type === "image" ? selectedAnnotation : null}
        onApply={(patch) => updateSelectedAnnotation(patch)}
      />
      <CompressDialog open={isCompressOpen} onOpenChange={setIsCompressOpen} onCompress={exportCompressedCopy} />
      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        fileName={fileName}
        pages={pages}
        pdfjsDocs={pdfjsDocs}
        onExportPdf={exportAndDownload}
      />
      <SecurityCenterDialog
        open={isSecurityCenterOpen}
        onOpenChange={setIsSecurityCenterOpen}
        documentId={documentId}
        fileName={fileName}
        doc={primaryDoc}
        sourceBytes={primarySourceId ? sources.get(primarySourceId)?.bytes : undefined}
        existingSignatures={signatureVerifications}
        exportCurrentBytes={exportCurrentBytes}
        onRestoreVersion={(bytes, restoredName) => {
          loadInitialFile(new File([bytes as BlobPart], restoredName, { type: "application/pdf" }));
        }}
        onScrubAndDownload={scrubAndDownload}
        onSecureShare={secureShareDownload}
      />
      <BarcodeScanDialog
        open={isBarcodeScanOpen}
        onOpenChange={setIsBarcodeScanOpen}
        pages={pages}
        pdfjsDocs={pdfjsDocs}
        onNavigate={jumpToPage}
      />
      <CertificateSignDialog
        open={isCertSignOpen}
        onOpenChange={setIsCertSignOpen}
        fileName={fileName}
        exportCurrentBytes={exportCurrentBytes}
        existingSignatures={signatureVerifications}
        onSigned={async (bytes) => {
          await logAuditEvent(documentId, fileName, "signed", "Signed with a stored certificate");
          await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-signed.pdf");
        }}
      />
      <BulkSignDialog
        open={isBulkSignOpen}
        onOpenChange={setIsBulkSignOpen}
        fileName={fileName}
        exportCurrentBytes={exportCurrentBytes}
      />
      <SignatureDialog
        open={isSignatureOpen}
        onOpenChange={(open) => {
          setIsSignatureOpen(open);
          if (!open) setSignatureFieldTarget(null);
        }}
        onInsert={(dataUrl, width, height) => {
          if (signatureFieldTarget) {
            const { pageId, field } = signatureFieldTarget;
            const fittedHeight = width > 0 ? Math.min(field.height, (field.width * height) / width) : field.height;
            addAnnotation(pageId, {
              id: createId(),
              type: "image",
              x: field.x,
              y: field.y + (field.height - fittedHeight) / 2,
              width: field.width,
              height: fittedHeight,
              dataUrl,
              rotation: 0,
              opacity: 1,
            });
            setSignatureFieldTarget(null);
          } else {
            setPendingImage({ dataUrl, width, height });
            setTool("image");
          }
        }}
      />
      <WatermarkDialog
        open={isWatermarkOpen}
        onOpenChange={setIsWatermarkOpen}
        watermark={watermark}
        onApply={setWatermark}
      />
      <PasswordDialog
        open={isPasswordOpen}
        onOpenChange={setIsPasswordOpen}
        encryption={encryption}
        onApply={setEncryption}
      />
      <MetadataDialog
        open={isMetadataOpen}
        onOpenChange={setIsMetadataOpen}
        metadata={metadata}
        onApply={setMetadata}
      />
      <BookmarksDialog
        open={isBookmarksOpen}
        onOpenChange={setIsBookmarksOpen}
        bookmarks={bookmarks}
        onApply={setBookmarks}
        pages={pages}
        currentPageId={currentPageId}
      />
      <PageNumbersDialog
        open={isPageNumbersOpen}
        onOpenChange={setIsPageNumbersOpen}
        pageNumbering={pageNumbering}
        onApply={setPageNumbering}
      />
      <SplitDialog
        open={isSplitOpen}
        onOpenChange={setIsSplitOpen}
        numPages={pages.length}
        onSplit={splitDocument}
      />
      <PropertiesDialog
        open={isPropertiesOpen}
        onOpenChange={setIsPropertiesOpen}
        fileName={fileName}
        pageCount={pages.length}
        fileSizeBytes={Array.from(sources.values()).reduce(
          (sum, s) => sum + (s.bytes instanceof ArrayBuffer ? s.bytes.byteLength : s.bytes.length),
          0
        )}
        doc={primaryDoc}
      />
      {isReadingMode && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsReadingMode(false)}
          className="fixed top-3 right-3 z-50 shadow-lg"
        >
          Exit reading mode
        </Button>
      )}
      {wasSourceEncrypted && (
        <div className="bg-background fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg">
          <span>This document was password-protected.</span>
          <button className="text-primary underline" onClick={saveUnlockedCopy}>
            Save unlocked copy
          </button>
        </div>
      )}
      {ocrProgress && (
        <div className="bg-background fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Recognizing text… {Math.round(ocrProgress.progress * 100)}%</span>
        </div>
      )}
      {!ocrProgress && ocrResult && (
        <div
          className={cn(
            "fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg",
            ocrResult.status === "success" ? "bg-success-soft text-success border-success/30" : "bg-destructive-soft text-destructive border-destructive/30"
          )}
        >
          {ocrResult.status === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{ocrResult.message}</span>
          <button aria-label="Dismiss" onClick={clearOcrResult} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {isSidebarOpen && !isReadingMode && (
          <>
            <SidebarRail active={sidebarPanel} onChange={setSidebarPanel} />
            <ScrollArea className="bg-muted/30 w-56 shrink-0 border-r">
              {sidebarPanel === "thumbnails" && (
                <div className="flex flex-col gap-2 p-2">
                  {pages.map((docPage, index) => {
                    const doc = pdfjsDocs.get(docPage.sourceId);
                    if (!doc) return null;
                    return (
                      <PdfThumbnail
                        key={docPage.id}
                        doc={doc}
                        sourcePageIndex={docPage.sourcePageIndex}
                        rotation={docPage.rotation}
                        label={index + 1}
                        isActive={docPage.id === currentPageId}
                        onClick={() => jumpToPage(docPage.id)}
                      />
                    );
                  })}
                </div>
              )}
              {sidebarPanel === "outline" && (
                <OutlinePanel pages={pages} pdfjsDocs={pdfjsDocs} onNavigate={jumpToPage} />
              )}
              {sidebarPanel === "layers" && (
                <LayersPanel config={ocgConfig} onToggle={handleToggleLayer} />
              )}
              {sidebarPanel === "attachments" && <AttachmentsPanel doc={primaryDoc} />}
              {sidebarPanel === "comments" && (
                <CommentsPanel pages={pages} onNavigate={jumpToPage} onDelete={deleteAnnotation} onUpdate={updateAnnotation} />
              )}
              {sidebarPanel === "accessibility" && (
                <AccessibilityPanel pages={pages} pdfjsDocs={pdfjsDocs} currentPageId={currentPageId} />
              )}
            </ScrollArea>
          </>
        )}

        <div ref={mainScrollRef} className="bg-muted/20 min-w-0 flex-1 overflow-auto">
          <div className="flex flex-col items-center gap-4 py-6">
            {visibleSpreads.map((spread) => (
              <div key={spread.map((p) => p.id).join("-")} className="flex items-start gap-2">
                {spread.map((docPage) => {
                  const doc = pdfjsDocs.get(docPage.sourceId);
                  if (!doc) return null;
                  return (
                    <PdfPageCanvas
                      key={docPage.id}
                      doc={doc}
                      sourcePageIndex={docPage.sourcePageIndex}
                      rotation={docPage.rotation}
                      scale={scale}
                      searchQuery={searchQuery}
                      optionalContentConfig={ocgConfig}
                      layersVersion={ocgVersion}
                      registerRef={(el) => {
                        if (el) pageRefs.current.set(docPage.id, el);
                        else pageRefs.current.delete(docPage.id);
                      }}
                      editTextMode={tool === "edit-text"}
                      onEditExistingText={(run) => handleEditExistingText(docPage.id, run)}
                      renderOverlay={(size) => (
                        <>
                          <AnnotationLayer
                            size={size}
                            scale={scale}
                            annotations={docPage.annotations}
                            tool={tool}
                            color={color}
                            pendingImage={pendingImage}
                            pendingStamp={pendingStamp}
                            measurementUnit={measurementUnit}
                            pageOptions={pageOptions}
                            selectedId={selection?.pageId === docPage.id ? selection.annotationId : null}
                            onSelectId={(id) => setSelection(id ? { pageId: docPage.id, annotationId: id } : null)}
                            editingId={editing?.pageId === docPage.id ? editing.annotationId : null}
                            onSetEditingId={(id) => setEditing(id ? { pageId: docPage.id, annotationId: id } : null)}
                            onAdd={(a) => addAnnotation(docPage.id, a)}
                            onUpdate={(id, patch) => updateAnnotation(docPage.id, id, patch)}
                            onDelete={(id) => deleteAnnotation(docPage.id, id)}
                            onImagePlaced={() => {
                              setPendingImage(null);
                              setTool("select");
                            }}
                            onStampPlaced={() => {
                              setPendingStamp(null);
                              setTool("select");
                            }}
                          />
                          <FormFieldLayer
                            doc={doc}
                            sourcePageIndex={docPage.sourcePageIndex}
                            rotation={docPage.rotation}
                            scale={scale}
                            annotations={docPage.annotations}
                            onFieldChange={(field, value) => setFormFieldValue(docPage.id, field, value)}
                            onSignatureFieldClick={(field) => {
                              setSignatureFieldTarget({ pageId: docPage.id, field });
                              setIsSignatureOpen(true);
                            }}
                          />
                          <MediaLayer
                            doc={doc}
                            sourcePageIndex={docPage.sourcePageIndex}
                            rotation={docPage.rotation}
                            scale={scale}
                            media={mediaByPageId.get(docPage.id) ?? EMPTY_MEDIA}
                          />
                        </>
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {isSearchOpen && !isReadingMode && (
          <PdfSearchPanel
            pages={pages}
            pdfjsDocs={pdfjsDocs}
            onClose={() => setIsSearchOpen(false)}
            onQueryChange={setSearchQuery}
            onSelectMatch={jumpToPage}
            onReplaceMatch={(match, replacement) =>
              replaceFirstMatchOnPage(match.pageId, searchQuery, replacement)
            }
          />
        )}
      </div>
      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        commands={commands}
        onQueryChange={handlePaletteQueryChange}
        searchHits={paletteSearchHits}
      />
    </div>
  );
}
