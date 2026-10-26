"use client";

import { useEffect, useState } from "react";
import { Home, FolderOpen, Clock, Star, Layers, Tag, Trash2, Search, Settings, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createCollection,
  distinctTags,
  listCollections,
  listLibraryDocs,
  type Collection,
  type LibraryFilter,
} from "@/lib/pdf/library";
import { createSmartFolder, listSmartFolders, type SmartFolder } from "@/lib/pdf/smart-folders";

export type Screen = "home" | "library" | "search" | "settings" | "viewer";

type GlobalNavSidebarProps = {
  screen: Screen;
  libraryFilter: LibraryFilter | null;
  onGoHome: () => void;
  onGoLibrary: (filter: LibraryFilter) => void;
  onGoSearch: () => void;
  onGoSettings: () => void;
  /** Bumped by the parent after a favorite/trash/tag/collection change to resync this rail. */
  refreshToken: number;
};

function NavRow({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  count?: number | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-foreground-tertiary text-xs">{count}</span>}
    </div>
  );
}

export function GlobalNavSidebar({
  screen,
  libraryFilter,
  onGoHome,
  onGoLibrary,
  onGoSearch,
  onGoSettings,
  refreshToken,
}: GlobalNavSidebarProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [trashCount, setTrashCount] = useState(0);

  useEffect(() => {
    Promise.all([listCollections(), listLibraryDocs(), listSmartFolders()]).then(([cols, docs, smart]) => {
      setCollections(cols);
      setTags(distinctTags(docs));
      setTrashCount(docs.filter((d) => d.trashed).length);
      setSmartFolders(smart);
    });
  }, [refreshToken]);

  async function handleNewCollection() {
    const name = window.prompt("New collection name");
    if (!name?.trim()) return;
    const collection = await createCollection(name.trim());
    setCollections((prev) => [...prev, collection].sort((a, b) => a.name.localeCompare(b.name)));
    onGoLibrary({ kind: "collection", id: collection.id, name: collection.name });
  }

  async function handleNewSmartFolder() {
    const name = window.prompt("Smart folder name");
    if (!name?.trim()) return;
    const query = window.prompt("Match documents whose name or tag contains…");
    if (!query?.trim()) return;
    const folder = await createSmartFolder(name.trim(), query.trim());
    setSmartFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
    onGoLibrary({ kind: "smart", id: folder.id, name: folder.name, query: folder.query });
  }

  const isLibraryFilter = (kind: LibraryFilter["kind"]) => screen === "library" && libraryFilter?.kind === kind;

  return (
    <div className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-56 shrink-0 flex-col border-r py-3">
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        <NavRow icon={Home} label="Home" active={screen === "home"} onClick={onGoHome} />
        <NavRow icon={FolderOpen} label="Library" active={isLibraryFilter("all")} onClick={() => onGoLibrary({ kind: "all" })} />
        <NavRow icon={Clock} label="Recent" active={isLibraryFilter("recent")} onClick={() => onGoLibrary({ kind: "recent" })} />
        <NavRow icon={Star} label="Favorites" active={isLibraryFilter("favorites")} onClick={() => onGoLibrary({ kind: "favorites" })} />

        <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
          <span className="text-foreground-tertiary text-[11px] font-semibold tracking-wide uppercase">Collections</span>
          <button
            aria-label="New collection"
            onClick={handleNewCollection}
            className="text-foreground-tertiary hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {collections.map((c) => (
          <NavRow
            key={c.id}
            icon={Layers}
            label={c.name}
            active={screen === "library" && libraryFilter?.kind === "collection" && libraryFilter.id === c.id}
            onClick={() => onGoLibrary({ kind: "collection", id: c.id, name: c.name })}
          />
        ))}
        {collections.length === 0 && (
          <p className="text-foreground-tertiary px-2.5 py-1 text-xs">No collections yet</p>
        )}

        <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
          <span className="text-foreground-tertiary text-[11px] font-semibold tracking-wide uppercase">
            Smart folders
          </span>
          <button
            aria-label="New smart folder"
            onClick={handleNewSmartFolder}
            className="text-foreground-tertiary hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {smartFolders.map((f) => (
          <NavRow
            key={f.id}
            icon={Sparkles}
            label={f.name}
            active={screen === "library" && libraryFilter?.kind === "smart" && libraryFilter.id === f.id}
            onClick={() => onGoLibrary({ kind: "smart", id: f.id, name: f.name, query: f.query })}
          />
        ))}
        {smartFolders.length === 0 && (
          <p className="text-foreground-tertiary px-2.5 py-1 text-xs">No smart folders yet</p>
        )}

        {tags.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-2.5">
              <span className="text-foreground-tertiary text-[11px] font-semibold tracking-wide uppercase">Tags</span>
            </div>
            {tags.map((tag) => (
              <NavRow
                key={tag}
                icon={Tag}
                label={tag}
                active={screen === "library" && libraryFilter?.kind === "tag" && libraryFilter.tag === tag}
                onClick={() => onGoLibrary({ kind: "tag", tag })}
              />
            ))}
          </>
        )}

        <div className="mt-4">
          <NavRow icon={Trash2} label="Trash" active={isLibraryFilter("trash")} count={trashCount || null} onClick={() => onGoLibrary({ kind: "trash" })} />
        </div>
      </div>

      <div className="border-sidebar-border flex flex-col gap-0.5 border-t px-2 pt-2">
        <NavRow icon={Search} label="Search" active={screen === "search"} onClick={onGoSearch} />
        <NavRow icon={Settings} label="Settings" active={screen === "settings"} onClick={onGoSettings} />
      </div>
    </div>
  );
}
