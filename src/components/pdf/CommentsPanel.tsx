"use client";

import { useRef, useState } from "react";
import {
  Highlighter,
  Pencil,
  Type,
  TextCursor,
  StickyNote,
  ImageIcon,
  Ban,
  Link2,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Quote,
  Stamp,
  Ruler,
  Underline,
  Strikethrough,
  Waves,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle as CircleIcon,
  Send,
  Mic,
  Square as StopIcon,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createId, parseMentions, renderMentionSegments, type Annotation, type CommentStatus, type DocPage, type Reply } from "@folio/engine";
import { getRecentMentionNames, recordMentionNames } from "@/lib/pdf/mention-history";

type CommentsPanelProps = {
  pages: DocPage[];
  onNavigate: (pageId: string) => void;
  onDelete: (pageId: string, annotationId: string) => void;
  onUpdate: (pageId: string, annotationId: string, patch: Partial<Annotation>) => void;
};

const ICONS: Record<Annotation["type"], typeof Highlighter> = {
  highlight: Highlighter,
  underline: Underline,
  strikeout: Strikethrough,
  squiggly: Waves,
  ink: Pencil,
  text: Type,
  callout: Quote,
  note: StickyNote,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  image: ImageIcon,
  stamp: Stamp,
  measurement: Ruler,
  redact: Ban,
  link: Link2,
  "form-field": Square,
  "form-field-create": Square,
  "text-edit": TextCursor,
};

const STATUS_OPTIONS: { id: CommentStatus; label: string; color: string }[] = [
  { id: "open", label: "Open", color: "#2563eb" },
  { id: "inProgress", label: "In progress", color: "#d97706" },
  { id: "completed", label: "Completed", color: "#16a34a" },
  { id: "cancelled", label: "Cancelled", color: "#6b7280" },
];

function describe(a: Annotation): string {
  switch (a.type) {
    case "text":
      return a.text || "(empty text box)";
    case "callout":
      return a.text || "(empty callout)";
    case "note":
      return a.text || "(empty note)";
    case "highlight":
      return "Highlight";
    case "underline":
      return "Underline";
    case "strikeout":
      return "Strikeout";
    case "squiggly":
      return "Squiggly underline";
    case "ink":
      return "Drawing";
    case "rect":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "line":
      return "Line";
    case "arrow":
      return "Arrow";
    case "measurement":
      return "Measurement";
    case "image":
      return "Image";
    case "stamp":
      return a.label ?? "Stamp";
    case "redact":
      return "Redaction";
    case "link":
      return a.target.kind === "url" ? a.target.url || "(empty link)" : "Link to page";
    case "form-field":
    case "form-field-create":
      return a.fieldName;
    case "text-edit":
      return `Edited text: "${a.newText}"`;
  }
}

export function CommentsPanel({ pages, onNavigate, onDelete, onUpdate }: CommentsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [showResolved, setShowResolved] = useState(true);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  const entries = pages.flatMap((page, index) =>
    page.annotations
      .filter((a) => a.type !== "form-field" && a.type !== "form-field-create")
      .filter((a) => showResolved || !a.resolved)
      .map((a) => ({ page, index, annotation: a }))
  );

  function resetComposer() {
    setReplyDraft("");
    setPendingImage(null);
    setPendingAudio(null);
    setMentionQuery(null);
  }

  function addReply(pageId: string, a: Annotation) {
    const text = replyDraft.trim();
    if (!text && !pendingImage && !pendingAudio) return;
    const reply: Reply = {
      id: createId(),
      author: "You",
      text,
      createdAt: Date.now(),
      ...(pendingImage ? { imageDataUrl: pendingImage } : {}),
      ...(pendingAudio ? { audioDataUrl: pendingAudio } : {}),
    };
    const replies = [...(a.replies ?? []), reply];
    onUpdate(pageId, a.id, { replies });
    recordMentionNames(parseMentions(text));
    resetComposer();
  }

  function handleReplyTextChange(value: string) {
    setReplyDraft(value);
    const caretMatch = /@([A-Za-z0-9_.-]*)$/.exec(value);
    setMentionQuery(caretMatch ? caretMatch[1] : null);
  }

  function applyMention(name: string) {
    setReplyDraft((prev) => prev.replace(/@([A-Za-z0-9_.-]*)$/, `@${name} `));
    setMentionQuery(null);
    replyInputRef.current?.focus();
  }

  function handleImagePicked(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function startRecording() {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => setPendingAudio(reader.result as string);
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecordError("Couldn't access the microphone — check your OS/browser permission for this app.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  if (entries.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">No comments or annotations yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <label className="text-muted-foreground flex items-center gap-1.5 px-1 pb-1 text-xs">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        Show resolved
      </label>

      {entries.map(({ page, index, annotation: a }) => {
        const Icon = ICONS[a.type];
        const isExpanded = expandedId === a.id;
        const status = STATUS_OPTIONS.find((s) => s.id === a.status);
        return (
          <div key={a.id} className={cn("group rounded-md border", a.resolved ? "opacity-60" : "")}>
            <div className="hover:bg-accent flex items-start gap-2 p-2 text-sm">
              <button
                className="mt-0.5 shrink-0"
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={() => onNavigate(page.id)}>
                <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    Page {index + 1}
                    {status && (
                      <span className="ml-1.5 inline-flex items-center gap-1" style={{ color: status.color }}>
                        · {status.label}
                      </span>
                    )}
                  </p>
                  <p className="truncate">{describe(a)}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label={a.resolved ? "Reopen" : "Resolve"}
                onClick={() => onUpdate(page.id, a.id, { resolved: !a.resolved })}
              >
                {a.resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <CircleIcon className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label="Delete"
                onClick={() => onDelete(page.id, a.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-2 border-t px-2 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground text-xs">Status:</span>
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onUpdate(page.id, a.id, { status: s.id })}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        a.status === s.id ? "text-white" : "text-muted-foreground"
                      )}
                      style={a.status === s.id ? { backgroundColor: s.color, borderColor: s.color } : undefined}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {(a.replies ?? []).map((r) => (
                  <div key={r.id} className="bg-muted/50 rounded p-1.5 text-xs">
                    <span className="font-medium">{r.author}</span>{" "}
                    <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                    {r.text && (
                      <p>
                        {renderMentionSegments(r.text).map((seg, i) =>
                          seg.type === "mention" ? (
                            <span key={i} className="bg-brand-soft text-brand rounded px-1 font-medium">
                              {seg.value}
                            </span>
                          ) : (
                            <span key={i}>{seg.value}</span>
                          )
                        )}
                      </p>
                    )}
                    {r.imageDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageDataUrl} alt="Attached" className="mt-1 max-h-40 max-w-full rounded border" />
                    )}
                    {r.audioDataUrl && (
                      <audio controls src={r.audioDataUrl} className="mt-1 h-8 w-full max-w-full" />
                    )}
                  </div>
                ))}

                <div className="relative flex min-w-0 flex-col gap-1.5">
                  {pendingImage && (
                    <div className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pendingImage} alt="Pending attachment" className="h-14 rounded border" />
                      <button
                        onClick={() => setPendingImage(null)}
                        aria-label="Remove attachment"
                        className="bg-background absolute -top-1.5 -right-1.5 rounded-full border p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {pendingAudio && (
                    <div className="flex items-center gap-1.5">
                      <audio controls src={pendingAudio} className="h-8 flex-1" />
                      <button onClick={() => setPendingAudio(null)} aria-label="Discard recording" className="shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {recordError && <p className="text-destructive text-[10px]">{recordError}</p>}

                  {isExpanded && mentionQuery !== null && (
                    <div className="bg-popover absolute bottom-full left-0 z-10 mb-1 w-40 rounded-md border shadow-md">
                      {getRecentMentionNames()
                        .filter((n) => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
                        .slice(0, 5)
                        .map((name) => (
                          <button
                            key={name}
                            onClick={() => applyMention(name)}
                            className="hover:bg-accent block w-full px-2 py-1 text-left text-xs"
                          >
                            @{name}
                          </button>
                        ))}
                      {mentionQuery && (
                        <button
                          onClick={() => applyMention(mentionQuery)}
                          className="hover:bg-accent block w-full px-2 py-1 text-left text-xs"
                        >
                          Mention &quot;{mentionQuery}&quot;
                        </button>
                      )}
                    </div>
                  )}

                  <input
                    ref={replyInputRef}
                    value={isExpanded ? replyDraft : ""}
                    onChange={(e) => handleReplyTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addReply(page.id, a);
                    }}
                    placeholder="Reply… (@ to mention)"
                    className="h-7 w-full min-w-0 rounded border px-2 text-xs"
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImagePicked(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      aria-label="Attach image"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant={isRecording ? "destructive" : "ghost"}
                      className="h-7 w-7 shrink-0"
                      aria-label={isRecording ? "Stop recording" : "Record audio comment"}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? <StopIcon className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => addReply(page.id, a)}
                      aria-label="Send reply"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
