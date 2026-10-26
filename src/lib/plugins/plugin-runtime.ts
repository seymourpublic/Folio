import { idbDelete, idbGet, idbGetAll, idbPut } from "@/lib/pdf/idb";

/** The surface a plugin's command actually gets at runtime. */
export type PluginApi = {
  getPageCount(): number;
  getCurrentPageIndex(): number;
  getPageText(pageIndex: number): Promise<string>;
  getAllPagesText(): Promise<string[]>;
  addTextAnnotation(
    pageIndex: number,
    opts: { x: number; y: number; text: string; fontSize?: number; color?: string }
  ): void;
  addNoteAnnotation(pageIndex: number, opts: { x: number; y: number; text: string; color?: string }): void;
  showMessage(message: string): void;
  prompt(message: string, defaultValue?: string): string | null;
};

export type PluginCommandDef = {
  id: string;
  title: string;
  run: (api: PluginApi) => void | Promise<void>;
};

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  commands: PluginCommandDef[];
};

export type StoredPlugin = {
  id: string;
  name: string;
  version: string;
  description: string;
  source: string;
  enabled: boolean;
  installedAt: number;
};

function isPluginCommandDef(value: unknown): value is PluginCommandDef {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.title === "string" && typeof c.run === "function";
}

function validateManifest(value: unknown): PluginManifest {
  if (!value || typeof value !== "object") {
    throw new Error("registerPlugin(...) must be called with an object.");
  }
  const m = value as Record<string, unknown>;
  if (typeof m.id !== "string" || !m.id.trim()) throw new Error("Plugin manifest is missing a string `id`.");
  if (typeof m.name !== "string" || !m.name.trim()) throw new Error("Plugin manifest is missing a string `name`.");
  if (typeof m.version !== "string" || !m.version.trim()) {
    throw new Error("Plugin manifest is missing a string `version`.");
  }
  if (!Array.isArray(m.commands) || m.commands.length === 0) {
    throw new Error("Plugin manifest must have a non-empty `commands` array.");
  }
  for (const c of m.commands) {
    if (!isPluginCommandDef(c)) {
      throw new Error("Every command needs a string `id`, string `title`, and function `run`.");
    }
  }
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    description: typeof m.description === "string" ? m.description : "",
    commands: m.commands as PluginCommandDef[],
  };
}

/** Runs plugin source in the same JS realm as the app (not a Worker/iframe). */
export function evaluatePluginSource(source: string): PluginManifest {
  let captured: unknown;
  let called = false;
  const registerPlugin = (manifest: unknown) => {
    called = true;
    captured = manifest;
  };
  const runSource = new Function("registerPlugin", `${source}\n//# sourceURL=plugin.js`);
  runSource(registerPlugin);
  if (!called) throw new Error("Plugin script never called registerPlugin(...).");
  return validateManifest(captured);
}

export async function installPlugin(source: string): Promise<StoredPlugin> {
  const manifest = evaluatePluginSource(source);
  const record: StoredPlugin = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? "",
    source,
    enabled: true,
    installedAt: Date.now(),
  };
  await idbPut("plugins", record);
  return record;
}

export async function listInstalledPlugins(): Promise<StoredPlugin[]> {
  const all = await idbGetAll<StoredPlugin>("plugins");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<void> {
  const record = await idbGet<StoredPlugin>("plugins", id);
  if (!record) return;
  await idbPut("plugins", { ...record, enabled });
}

export async function removePlugin(id: string): Promise<void> {
  await idbDelete("plugins", id);
}

/** Re-evaluates every enabled plugin's stored source to rebuild its live manifest; only the
 * source survives IndexedDB. A plugin that fails to evaluate is reported per-plugin. */
export async function loadEnabledPluginManifests(): Promise<
  { plugin: StoredPlugin; manifest: PluginManifest | null; error?: string }[]
> {
  const plugins = await listInstalledPlugins();
  return plugins
    .filter((p) => p.enabled)
    .map((plugin) => {
      try {
        return { plugin, manifest: evaluatePluginSource(plugin.source) };
      } catch (err) {
        return { plugin, manifest: null, error: err instanceof Error ? err.message : String(err) };
      }
    });
}
