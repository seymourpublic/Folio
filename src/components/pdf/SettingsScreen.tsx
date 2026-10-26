"use client";

import { useEffect, useRef, useState } from "react";
import { FolderPlus, X, FolderSync, Puzzle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import {
  getAutosaveEnabled,
  getDefaultViewMode,
  getOcrDenoise,
  getOcrDeskew,
  getOcrLanguages,
  getReduceMotion,
  getScreenTransitionsEnabled,
  setAutosaveEnabled,
  setDefaultViewMode,
  setOcrDenoise,
  setOcrDeskew,
  setOcrLanguages,
  setReduceMotion,
  setScreenTransitionsEnabled,
} from "@/lib/app-settings";
import { OCR_LANGUAGES } from "@folio/engine/ocr";
import { formatShortcut } from "@/lib/commands/shortcuts";
import { SHORTCUT_MANIFEST } from "@/lib/commands/shortcut-manifest";
import type { ViewMode } from "@folio/engine";
import { Button } from "@/components/ui/button";
import {
  addWatchedFolder,
  listWatchedFolders,
  pickFolderToWatch,
  removeWatchedFolder,
  useIsElectron,
} from "@/lib/electron-bridge";
import {
  installPlugin,
  listInstalledPlugins,
  removePlugin,
  setPluginEnabled,
  type StoredPlugin,
} from "@/lib/plugins/plugin-runtime";

type SettingsSection = "general" | "appearance" | "ocr" | "automation" | "plugins" | "shortcuts";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "ocr", label: "OCR" },
  { id: "automation", label: "Automation" },
  { id: "plugins", label: "Plugins" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
];

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  continuous: "Continuous scroll",
  single: "Single page",
  facing: "Facing pages",
  cover: "Cover page",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[38px] rounded-full transition-colors", checked ? "bg-brand" : "bg-border")}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [reduceMotion, setReduceMotionState] = useState(() => getReduceMotion());
  const [screenTransitions, setScreenTransitionsState] = useState(() => getScreenTransitionsEnabled());
  const [defaultViewMode, setDefaultViewModeState] = useState<ViewMode>(() => getDefaultViewMode());
  const [autosaveEnabled, setAutosaveEnabledState] = useState(() => getAutosaveEnabled());
  const isElectron = useIsElectron();
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [plugins, setPlugins] = useState<StoredPlugin[]>([]);
  const [pluginInstallError, setPluginInstallError] = useState<string | null>(null);
  const pluginFileInputRef = useRef<HTMLInputElement | null>(null);
  const [ocrLanguages, setOcrLanguagesState] = useState<string[]>(() => getOcrLanguages());
  const [ocrDeskew, setOcrDeskewState] = useState(() => getOcrDeskew());
  const [ocrDenoise, setOcrDenoiseState] = useState(() => getOcrDenoise());

  function toggleOcrLanguage(code: string) {
    const next = ocrLanguages.includes(code)
      ? ocrLanguages.filter((c) => c !== code)
      : [...ocrLanguages, code];
    if (next.length === 0) return; // always keep at least one language selected
    setOcrLanguages(next);
    setOcrLanguagesState(next);
  }

  useEffect(() => {
    if (isElectron) listWatchedFolders().then(setWatchedFolders);
  }, [isElectron]);

  useEffect(() => {
    listInstalledPlugins().then(setPlugins);
  }, []);

  async function handlePluginFileSelected(file: File) {
    setPluginInstallError(null);
    try {
      const source = await file.text();
      await installPlugin(source);
      setPlugins(await listInstalledPlugins());
    } catch (err) {
      setPluginInstallError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTogglePlugin(id: string, enabled: boolean) {
    await setPluginEnabled(id, enabled);
    setPlugins(await listInstalledPlugins());
  }

  async function handleRemovePlugin(id: string) {
    await removePlugin(id);
    setPlugins(await listInstalledPlugins());
  }

  async function handleAddWatchedFolder() {
    setIsAddingFolder(true);
    try {
      const folderPath = await pickFolderToWatch();
      if (!folderPath) return;
      setWatchedFolders(await addWatchedFolder(folderPath));
    } finally {
      setIsAddingFolder(false);
    }
  }

  async function handleRemoveWatchedFolder(folderPath: string) {
    setWatchedFolders(await removeWatchedFolder(folderPath));
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="border-border w-56 shrink-0 border-r px-3 py-6">
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "mb-0.5 cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium",
              section === s.id ? "bg-brand-soft text-brand" : "hover:bg-muted"
            )}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="max-w-xl flex-1 overflow-y-auto px-10 py-8">
        <h1 className="mb-6 text-lg font-semibold">{SECTIONS.find((s) => s.id === section)?.label}</h1>

        {section === "appearance" && (
          <div className="flex flex-col gap-7">
            <div>
              <div className="mb-2.5 text-sm font-semibold">Theme</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex-1 rounded-xl border-2 bg-white p-3.5",
                    theme === "light" ? "border-brand" : "border-transparent"
                  )}
                >
                  <div className="mb-2 h-10 rounded-md border border-[#E5E7EB] bg-[#F1F5F9]" />
                  <div className="text-xs font-medium text-[#111827]">Light</div>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex-1 rounded-xl border-2 bg-[#111827] p-3.5",
                    theme === "dark" ? "border-brand" : "border-transparent"
                  )}
                >
                  <div className="mb-2 h-10 rounded-md border border-[#1F2937] bg-[#0F172A]" />
                  <div className="text-xs font-medium text-[#F9FAFB]">Dark</div>
                </button>
              </div>
            </div>

            <div className="border-border flex items-center justify-between border-t pt-5">
              <div>
                <div className="text-sm font-medium">Reduce motion</div>
                <div className="text-muted-foreground text-xs">Minimize animations across the app</div>
              </div>
              <Toggle
                checked={reduceMotion}
                onChange={(v) => {
                  setReduceMotion(v);
                  setReduceMotionState(v);
                }}
              />
            </div>

            <div className="border-border flex items-center justify-between border-t pt-5">
              <div>
                <div className="text-sm font-medium">Screen transitions</div>
                <div className="text-muted-foreground text-xs">
                  Animate switching between Home, Library, and other screens
                </div>
              </div>
              <Toggle
                checked={screenTransitions}
                onChange={(v) => {
                  setScreenTransitionsEnabled(v);
                  setScreenTransitionsState(v);
                }}
              />
            </div>
          </div>
        )}

        {section === "general" && (
          <div className="flex flex-col gap-1">
            <div className="border-border flex items-center justify-between border-b py-3.5">
              <div>
                <div className="text-sm font-medium">Default view mode</div>
                <div className="text-muted-foreground text-xs">How newly opened documents display</div>
              </div>
              <select
                value={defaultViewMode}
                onChange={(e) => {
                  const mode = e.target.value as ViewMode;
                  setDefaultViewMode(mode);
                  setDefaultViewModeState(mode);
                }}
                className="border-border bg-background rounded-lg border px-2.5 py-1.5 text-xs"
              >
                {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {VIEW_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <div>
                <div className="text-sm font-medium">Autosave</div>
                <div className="text-muted-foreground text-xs">Periodically save changes for crash recovery</div>
              </div>
              <Toggle
                checked={autosaveEnabled}
                onChange={(v) => {
                  setAutosaveEnabled(v);
                  setAutosaveEnabledState(v);
                }}
              />
            </div>
          </div>
        )}

        {section === "automation" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-1 text-sm font-semibold">Watched folders</div>
              <p className="text-muted-foreground text-xs">
                PDFs dropped into a watched folder (e.g. a scanner&apos;s output folder) are
                automatically imported into your Library. Only newly-arrived files count —
                what&apos;s already in the folder when you add it is left alone. Top-level only;
                subfolders aren&apos;t watched.
              </p>
            </div>

            {!isElectron ? (
              <div className="border-border bg-muted/40 rounded-xl border p-4 text-sm">
                Watched folders need real filesystem access, so this is only available in the
                desktop app.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {watchedFolders.length === 0 && (
                    <div className="text-muted-foreground text-xs">No folders watched yet.</div>
                  )}
                  {watchedFolders.map((folderPath) => (
                    <div
                      key={folderPath}
                      className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <FolderSync className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs" title={folderPath}>
                        {folderPath}
                      </span>
                      <button
                        aria-label="Stop watching this folder"
                        onClick={() => handleRemoveWatchedFolder(folderPath)}
                        className="text-muted-foreground hover:text-foreground rounded p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={isAddingFolder}
                  onClick={handleAddWatchedFolder}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Add folder to watch…
                </Button>
              </>
            )}
          </div>
        )}

        {section === "plugins" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-1 text-sm font-semibold">Installed plugins</div>
              <p className="text-muted-foreground text-xs">
                A plugin is a single .js file that registers one or more commands into the
                command palette (Ctrl/Cmd+K) — it can read the open document&apos;s text and add
                annotations, but nothing outside the app. Plugins run with the same access as
                the app itself, so only install ones you trust.
              </p>
            </div>

            {pluginInstallError && (
              <div className="border-destructive/40 bg-destructive-soft text-destructive rounded-lg border p-3 text-xs">
                Couldn&apos;t install: {pluginInstallError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {plugins.length === 0 && (
                <div className="text-muted-foreground text-xs">No plugins installed yet.</div>
              )}
              {plugins.map((p) => (
                <div key={p.id} className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2.5">
                  <Puzzle className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground text-[11px] font-normal">v{p.version}</span>
                    </div>
                    {p.description && (
                      <div className="text-muted-foreground truncate text-xs">{p.description}</div>
                    )}
                  </div>
                  <Toggle checked={p.enabled} onChange={(v) => handleTogglePlugin(p.id, v)} />
                  <button
                    aria-label={`Remove ${p.name}`}
                    onClick={() => handleRemovePlugin(p.id)}
                    className="text-muted-foreground hover:text-destructive rounded p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <input
              ref={pluginFileInputRef}
              type="file"
              accept=".js,text/javascript"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePluginFileSelected(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => pluginFileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Install plugin (.js)…
            </Button>
          </div>
        )}

        {section === "ocr" && (
          <div className="flex flex-col gap-7">
            <div>
              <div className="mb-2.5 text-sm font-semibold">Languages</div>
              <p className="text-muted-foreground mb-3 text-xs">
                Used for both manual &quot;Run OCR&quot; and automatic background OCR of scanned
                pages. Selecting several runs recognition against all of them at once (useful for
                multilingual documents) but is slower — most documents only need one.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {OCR_LANGUAGES.map((lang) => (
                  <label
                    key={lang.code}
                    className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={ocrLanguages.includes(lang.code)}
                      onChange={() => toggleOcrLanguage(lang.code)}
                    />
                    {lang.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-border flex items-center justify-between border-t pt-5">
              <div>
                <div className="text-sm font-medium">Auto-straighten scans (deskew)</div>
                <div className="text-muted-foreground text-xs">
                  Detects and corrects crooked/rotated scans before recognition
                </div>
              </div>
              <Toggle
                checked={ocrDeskew}
                onChange={(v) => {
                  setOcrDeskew(v);
                  setOcrDeskewState(v);
                }}
              />
            </div>

            <div className="border-border flex items-center justify-between border-t pt-5">
              <div>
                <div className="text-sm font-medium">Clean up scan noise (denoise)</div>
                <div className="text-muted-foreground text-xs">
                  Binarizes the page before recognition — usually improves accuracy on noisy scans
                </div>
              </div>
              <Toggle
                checked={ocrDenoise}
                onChange={(v) => {
                  setOcrDenoise(v);
                  setOcrDenoiseState(v);
                }}
              />
            </div>
          </div>
        )}

        {section === "shortcuts" && (
          <div className="flex flex-col gap-0.5">
            {SHORTCUT_MANIFEST.map((s) => (
              <div key={s.label} className="border-border flex items-center justify-between border-b py-2.5 last:border-b-0">
                <div className="text-sm">{s.label}</div>
                <div className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs">
                  {formatShortcut(s.shortcut)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
