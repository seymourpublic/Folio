"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
  error?: string | null;
};

export function UploadDropzone({ onFilesSelected, isLoading, error }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const pdfFiles = Array.from(files ?? []).filter((f) => f.type === "application/pdf");
      if (pdfFiles.length > 0) onFilesSelected(pdfFiles);
    },
    [onFilesSelected]
  );

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-16 text-center transition-colors",
          isDragging ? "border-primary bg-accent" : "border-border hover:bg-accent/40"
        )}
      >
        {isLoading ? (
          <Loader2 className="text-muted-foreground h-10 w-10 animate-spin" />
        ) : (
          <FileUp className="text-muted-foreground h-10 w-10" />
        )}
        <div className="space-y-1">
          <p className="text-lg font-medium">
            {isLoading ? "Opening PDF…" : "Drop one or more PDFs here, or click to browse"}
          </p>
          <p className="text-muted-foreground text-sm">
            Select multiple files to combine them into one document. Your files stay in the
            browser — nothing is uploaded.
          </p>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
