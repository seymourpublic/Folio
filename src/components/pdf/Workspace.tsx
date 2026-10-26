"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { AppTopbar } from "@/components/pdf/AppTopbar";
import { GlobalNavSidebar, type Screen } from "@/components/pdf/GlobalNavSidebar";
import { HomeScreen } from "@/components/pdf/HomeScreen";
import { LibraryScreen } from "@/components/pdf/LibraryScreen";
import { SearchScreen } from "@/components/pdf/SearchScreen";
import { SettingsScreen } from "@/components/pdf/SettingsScreen";
import { CommandPalette } from "@/components/pdf/CommandPalette";
import { CrashRecoveryDialog } from "@/components/pdf/CrashRecoveryDialog";
import { SplashScreen } from "@/components/pdf/SplashScreen";
import { createId } from "@folio/engine";
import { deleteAutosave, listAutosaves, type AutosaveSummary } from "@/lib/pdf/autosave";
import { onWatchedFileAdded, useIsElectron } from "@/lib/electron-bridge";
import { getLibraryDocBytes, type LibraryDocSummary, type LibraryFilter } from "@/lib/pdf/library";
import { getReduceMotion, getScreenTransitionsEnabled } from "@/lib/app-settings";
import { useTheme } from "@/hooks/useTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SHORTCUTS } from "@/lib/commands/shortcut-manifest";
import type { Command } from "@/lib/commands/types";

const PdfViewer = dynamic(
  () => import("@/components/pdf/PdfViewer").then((mod) => mod.PdfViewer),
  { ssr: false }
);

type Tab = { id: string; file: File; additionalFiles: File[]; restoreId?: string };

export function Workspace() {
  const [screen, setScreen] = useState<Screen>("home");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>({ kind: "all" });
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<AutosaveSummary[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [readingModeTabId, setReadingModeTabId] = useState<string | null>(null);
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);
  const newTabFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toggleTheme } = useTheme();
  const isElectron = useIsElectron();
  const [showSplash, setShowSplash] = useState(true);

  const [displayedScreen, setDisplayedScreen] = useState<Screen>(screen);
  const [screenVisible, setScreenVisible] = useState(true);
  // Tracks only whether a crossfade is actively in flight — see the style object below for why.
  const [isTransitioning, setIsTransitioning] = useState(false);

  if (screen !== displayedScreen && (getReduceMotion() || !getScreenTransitionsEnabled())) {
    setDisplayedScreen(screen);
  }

  useEffect(() => {
    window.electronAPI?.onOpenFile(({ name, bytes }) => {
      openFiles([new File([bytes as BlobPart], name, { type: "application/pdf" })]);
    });
    onWatchedFileAdded((payload) => {
      import("@/lib/pdf/folder-watch").then(({ importWatchedFile }) =>
        importWatchedFile(payload).then((ok) => {
          if (ok) bumpLibraryRefresh();
        })
      );
    });
    listAutosaves().then(setRecoverable).catch(() => {});

    import("@/lib/pdf/library-index").then(({ runLibraryBackgroundIndex }) => runLibraryBackgroundIndex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === displayedScreen) return;
    if (getReduceMotion() || !getScreenTransitionsEnabled()) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTransitioning(true);
    setScreenVisible(false);
    const t = setTimeout(() => {
      setDisplayedScreen(screen);
      requestAnimationFrame(() => requestAnimationFrame(() => setScreenVisible(true)));
    }, 150);
    return () => clearTimeout(t);
  }, [screen, displayedScreen]);

  useEffect(() => {
    if (!isTransitioning || !screenVisible) return;
    const t = setTimeout(() => setIsTransitioning(false), 200);
    return () => clearTimeout(t);
  }, [isTransitioning, screenVisible]);

  function bumpLibraryRefresh() {
    setLibraryRefreshToken((t) => t + 1);
  }

  function restoreAutosave(entry: AutosaveSummary) {
    const id = createId();
    const placeholder = new File([], entry.fileName || "Untitled.pdf", { type: "application/pdf" });
    setTabs((prev) => [...prev, { id, file: placeholder, additionalFiles: [], restoreId: entry.id }]);
    setActiveTabId(id);
    setScreen("viewer");
    setRecoverable((prev) => prev.filter((r) => r.id !== entry.id));
  }

  function discardAutosave(entry: AutosaveSummary) {
    deleteAutosave(entry.id).catch(() => {});
    setRecoverable((prev) => prev.filter((r) => r.id !== entry.id));
  }

  function discardAllAutosaves() {
    for (const entry of recoverable) deleteAutosave(entry.id).catch(() => {});
    setRecoverable([]);
  }

  function openFiles(files: File[]) {
    const id = createId();
    setTabs((prev) => [...prev, { id, file: files[0], additionalFiles: files.slice(1) }]);
    setActiveTabId(id);
    setScreen("viewer");
  }

  async function openLibraryDoc(doc: LibraryDocSummary) {
    const bytes = await getLibraryDocBytes(doc.id);
    if (!bytes) return;
    openFiles([new File([bytes as BlobPart], doc.name, { type: "application/pdf" })]);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const nextActive = next[next.length - 1]?.id ?? null;
        setActiveTabId(nextActive);
        if (!nextActive) setScreen("home");
      }
      return next;
    });
    if (splitTabId === id) setSplitTabId(null);
  }

  function replaceTabFile(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) setActiveTabId(next[next.length - 1]?.id ?? null);
      return next;
    });
    if (splitTabId === id) setSplitTabId(null);
  }

  function toggleSplit() {
    if (splitTabId) {
      setSplitTabId(null);
      return;
    }
    const other = tabs.find((t) => t.id !== activeTabId);
    if (other) setSplitTabId(other.id);
  }

  function requestNewTab() {
    newTabFileInputRef.current?.click();
  }

  function goHome() {
    setScreen("home");
  }

  function goLibrary(filter: LibraryFilter) {
    setLibraryFilter(filter);
    setScreen("library");
  }

  function goSearch() {
    setScreen("search");
  }

  function goSettings() {
    setScreen("settings");
  }

  const workspaceCommands: Command[] = [
    { id: "ws-palette", title: "Open command palette", category: "navigation", shortcut: SHORTCUTS.commandPalette, run: () => setIsPaletteOpen(true) },
    { id: "ws-home", title: "Go to Home", category: "navigation", run: goHome },
    { id: "ws-library", title: "Go to Library", category: "navigation", run: () => goLibrary({ kind: "all" }) },
    { id: "ws-favorites", title: "Go to Favorites", category: "navigation", run: () => goLibrary({ kind: "favorites" }) },
    { id: "ws-trash", title: "Go to Trash", category: "navigation", run: () => goLibrary({ kind: "trash" }) },
    { id: "ws-search", title: "Go to Search", category: "navigation", run: goSearch },
    { id: "ws-settings", title: "Go to Settings", category: "navigation", run: goSettings },
    { id: "ws-open", title: "Open document…", category: "file", run: requestNewTab },
    { id: "ws-theme", title: "Toggle Dark Mode", category: "view", run: toggleTheme },
    ...(isElectron
      ? [{ id: "ws-new-window", title: "New window", category: "file" as const, run: () => window.electronAPI?.newWindow() }]
      : []),
  ];
  useKeyboardShortcuts(workspaceCommands, screen !== "viewer");
  const isReadingModeActive = screen === "viewer" && readingModeTabId !== null && readingModeTabId === activeTabId;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf");
        if (files.length) openFiles(files);
      }}
    >
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <CrashRecoveryDialog
        entries={recoverable}
        onRestore={restoreAutosave}
        onDiscard={discardAutosave}
        onDiscardAll={discardAllAutosaves}
      />

      {!isReadingModeActive && (
        <AppTopbar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
          tabs={tabs.map((t) => ({ id: t.id, label: t.file.name }))}
          activeTabId={activeTabId}
          splitTabId={splitTabId}
          onActivateTab={(id) => {
            setActiveTabId(id);
            setScreen("viewer");
          }}
          onCloseTab={closeTab}
          onRequestNewTab={requestNewTab}
          onToggleSplit={toggleSplit}
          canSplit={tabs.length > 1}
          onOpenPalette={() => setIsPaletteOpen(true)}
        />
      )}
      <input
        ref={newTabFileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => f.type === "application/pdf");
          if (files.length) openFiles(files);
          e.target.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1">
        {!isSidebarCollapsed && !isReadingModeActive && (
          <GlobalNavSidebar
            screen={screen}
            libraryFilter={screen === "library" ? libraryFilter : null}
            onGoHome={goHome}
            onGoLibrary={goLibrary}
            onGoSearch={goSearch}
            onGoSettings={goSettings}
            refreshToken={libraryRefreshToken}
          />
        )}

        <div
          className="flex min-h-0 flex-1 flex-col"
          style={
            isTransitioning
              ? {
                  opacity: screenVisible ? 1 : 0,
                  transform: screenVisible ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 180ms ease-out, transform 180ms ease-out",
                  willChange: "opacity, transform",
                }
              : undefined
          }
        >
          {displayedScreen === "home" && (
            <HomeScreen
              onRequestOpen={requestNewTab}
              onOpenLibraryDoc={openLibraryDoc}
              onGoLibrary={goLibrary}
              onOpenPalette={() => setIsPaletteOpen(true)}
              refreshToken={libraryRefreshToken}
            />
          )}
          {displayedScreen === "library" && (
            <LibraryScreen
              filter={libraryFilter}
              onOpenLibraryDoc={openLibraryDoc}
              onChanged={bumpLibraryRefresh}
              refreshToken={libraryRefreshToken}
            />
          )}
          {displayedScreen === "search" && <SearchScreen onOpenLibraryDoc={openLibraryDoc} />}
          {displayedScreen === "settings" && <SettingsScreen />}

          {tabs.length > 0 && (
            <div className={cn("min-h-0 flex-1", displayedScreen === "viewer" ? "flex" : "hidden")}>
              {tabs.map((tab) => {
                const isVisible = tab.id === activeTabId || tab.id === splitTabId;
                return (
                  <div
                    key={tab.id}
                    data-tab-pane={tab.id}
                    className={isVisible ? "flex min-h-0 min-w-0 flex-1 flex-col border-r last:border-r-0" : "hidden"}
                  >
                    <PdfViewer
                      file={tab.file}
                      additionalFiles={tab.additionalFiles}
                      restoreId={tab.restoreId}
                      isActive={screen === "viewer" && tab.id === activeTabId}
                      onOpenNewFile={() => replaceTabFile(tab.id)}
                      onNewTab={requestNewTab}
                      onCloseTab={() => closeTab(tab.id)}
                      onToggleSplit={toggleSplit}
                      canToggleSplit={tabs.length > 1}
                      onNewWindow={isElectron ? () => window.electronAPI?.newWindow() : undefined}
                      onReadingModeChange={(active) =>
                        setReadingModeTabId((prev) => (active ? tab.id : prev === tab.id ? null : prev))
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CommandPalette open={isPaletteOpen} onOpenChange={setIsPaletteOpen} commands={workspaceCommands} />
    </div>
  );
}
