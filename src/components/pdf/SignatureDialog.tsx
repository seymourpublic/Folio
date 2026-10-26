"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { signatureFonts } from "@/lib/fonts";

type SignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (dataUrl: string, width: number, height: number) => void;
};

const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 160;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function SignatureDialog({ open, onOpenChange, onInsert }: SignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [typedName, setTypedName] = useState("");
  const [fontId, setFontId] = useState<(typeof signatureFonts)[number]["id"]>(signatureFonts[0].id);

  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedSize, setUploadedSize] = useState<{ width: number; height: number } | null>(null);

  const [signerName, setSignerName] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("signerName") ?? "") : ""
  );
  const [includeStamp, setIncludeStamp] = useState(true);
  const [activeTab, setActiveTab] = useState("draw");

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
  }, [open]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    isDrawingRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f2937";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
    setHasDrawn(true);
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
  }

  async function renderTypedSignature(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const name = typedName.trim();
    if (!name) return null;
    const selected = signatureFonts.find((f) => f.id === fontId) ?? signatureFonts[0];
    const fontFamily = selected.font.style.fontFamily;

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    const fontSize = 56;
    try {
      await document.fonts.load(`${fontSize}px ${fontFamily}`);
    } catch {
      // fall back to default font metrics if load fails
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1f2937";
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.fillText(name, 16, canvas.height / 2);

    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  }

  async function composeWithStamp(base: { dataUrl: string; width: number; height: number }) {
    if (!includeStamp || !signerName.trim()) return base;

    const img = await loadImage(base.dataUrl);
    const stampText = `Signed by ${signerName.trim()} · ${new Date().toLocaleDateString()}`;

    const canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height + 28;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, base.width, base.height);
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#4b5563";
    ctx.textBaseline = "top";
    ctx.fillText(stampText, 4, base.height + 6);

    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  }

  async function handleInsert() {
    if (typeof window !== "undefined") localStorage.setItem("signerName", signerName);

    let base: { dataUrl: string; width: number; height: number } | null = null;

    if (activeTab === "draw" && hasDrawn && canvasRef.current) {
      base = {
        dataUrl: canvasRef.current.toDataURL("image/png"),
        width: canvasRef.current.width,
        height: canvasRef.current.height,
      };
    } else if (activeTab === "type") {
      base = await renderTypedSignature();
    } else if (activeTab === "upload" && uploadedDataUrl && uploadedSize) {
      base = { dataUrl: uploadedDataUrl, width: uploadedSize.width, height: uploadedSize.height };
    }

    if (!base) return;
    const final = await composeWithStamp(base);
    onInsert(final.dataUrl, final.width, final.height);
    onOpenChange(false);
  }

  function handleUploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      loadImage(dataUrl).then((img) => {
        setUploadedDataUrl(dataUrl);
        setUploadedSize({ width: img.naturalWidth, height: img.naturalHeight });
      });
    };
    reader.readAsDataURL(file);
  }

  const canInsert =
    (activeTab === "draw" && hasDrawn) ||
    (activeTab === "type" && typedName.trim().length > 0) ||
    (activeTab === "upload" && Boolean(uploadedDataUrl));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add your signature</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full touch-none rounded-md border bg-white"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <Button variant="ghost" size="sm" onClick={clearCanvas}>
              Clear
            </Button>
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <Input
              placeholder="Type your name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              {signatureFonts.map(({ id, label, font }) => (
                <button
                  key={id}
                  onClick={() => setFontId(id)}
                  className={cn(
                    "rounded-md border p-3 text-xl",
                    font.className,
                    fontId === id ? "border-primary ring-1 ring-primary" : "border-border"
                  )}
                >
                  {typedName.trim() || label}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-2">
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
              }}
            />
            {uploadedDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploadedDataUrl} alt="Uploaded signature" className="max-h-32 rounded-md border bg-white p-2" />
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-stamp"
              checked={includeStamp}
              onCheckedChange={(checked) => setIncludeStamp(Boolean(checked))}
            />
            <Label htmlFor="include-stamp" className="text-sm font-normal">
              Add name &amp; date stamp
            </Label>
          </div>
          {includeStamp && (
            <Input
              placeholder="Your name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="h-8"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canInsert} onClick={handleInsert}>
            Insert signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
