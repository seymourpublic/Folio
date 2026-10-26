"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Library, Command, MessageSquare, CheckSquare, ShieldCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import {
  filterLibraryDocs,
  listLibraryDocs,
  type LibraryDocSummary,
  type LibraryFilter,
} from "@/lib/pdf/library";
import { getRecentActivityAcrossDocuments, type ActivityEntry } from "@/lib/pdf/audit-log";
import type { AuditEventType } from "@folio/engine";

type HomeScreenProps = {
  onRequestOpen: () => void;
  onOpenLibraryDoc: (doc: LibraryDocSummary) => void;
  onGoLibrary: (filter: LibraryFilter) => void;
  onOpenPalette: () => void;
  refreshToken: number;
};

const ACTIVITY_ICON: Record<AuditEventType, typeof FileText> = {
  opened: FolderOpen,
  annotated: MessageSquare,
  "form-filled": CheckSquare,
  signed: CheckSquare,
  encrypted: ShieldCheck,
  redacted: ShieldCheck,
  compressed: FileText,
  exported: FileText,
  "metadata-scrubbed": FileText,
  custom: FileText,
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen({ onRequestOpen, onOpenLibraryDoc, onGoLibrary, onOpenPalette, refreshToken }: HomeScreenProps) {
  const [recentDocs, setRecentDocs] = useState<LibraryDocSummary[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    listLibraryDocs().then((docs) => setRecentDocs(filterLibraryDocs(docs, { kind: "recent" }).slice(0, 4)));
    getRecentActivityAcrossDocuments(6).then(setActivity);
  }, [refreshToken]);

  const quickActions = [
    { key: "open", label: "Open Document", sub: "From your computer", icon: FolderOpen, iconBg: "bg-brand-soft", iconColor: "text-brand", onClick: onRequestOpen },
    { key: "library", label: "Browse Library", sub: "Every document you've opened", icon: Library, iconBg: "bg-success-soft", iconColor: "text-success", onClick: () => onGoLibrary({ kind: "all" }) },
    { key: "palette", label: "Command Palette", sub: "Search or run any action", icon: Command, iconBg: "bg-warning-soft", iconColor: "text-warning", onClick: onOpenPalette },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-12 py-10">
      <h1 className="mb-0.5 text-xl font-semibold tracking-tight">{greeting()}</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Quick actions</h2>
      <div className="mb-10 flex gap-3">
        {quickActions.map((q) => (
          <button
            key={q.key}
            onClick={q.onClick}
            className="border-border bg-card hover:border-border-strong flex flex-1 flex-col gap-2.5 rounded-2xl border p-5 text-left"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", q.iconBg, q.iconColor)}>
              <q.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="text-sm font-semibold">{q.label}</div>
            <div className="text-muted-foreground text-xs">{q.sub}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Continue reading</h2>
        <button onClick={() => onGoLibrary({ kind: "all" })} className="text-brand text-xs">
          View all
        </button>
      </div>
      {recentDocs.length === 0 ? (
        <p className="text-muted-foreground mb-10 text-sm">Nothing opened yet — open a document to see it here.</p>
      ) : (
        <div className="mb-10 flex gap-3.5">
          {recentDocs.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpenLibraryDoc(d)}
              className="w-44 shrink-0 cursor-pointer text-left"
            >
              <div className="border-border bg-card mb-2 h-32 overflow-hidden rounded-xl border">
                {d.thumbnailDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnailDataUrl} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="text-foreground-tertiary flex h-full items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="truncate text-xs font-semibold">{d.name}</div>
              <div className="text-muted-foreground text-[11px]">
                {formatRelativeTime(d.lastOpenedAt)} · {d.pageCount} pages
              </div>
            </button>
          ))}
        </div>
      )}

      <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Recent activity</h2>
      {activity.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet.</p>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          {activity.map((a) => {
            const Icon = ACTIVITY_ICON[a.type];
            return (
              <div key={a.id} className="border-border flex items-center gap-3 border-b px-4.5 py-3.5 last:border-b-0">
                <div className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                </div>
                <div className="flex-1 text-sm">
                  {a.detail} <span className="text-muted-foreground">— {a.fileName}</span>
                </div>
                <div className="text-foreground-tertiary text-[11px]">{formatRelativeTime(a.timestamp)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
