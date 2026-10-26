"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadPdfDocument,
  PdfPasswordRequiredError,
  createId,
  pagesFromSource,
  exportDocument,
  extractPagesAsPdf,
  exportPageAsSvg,
  decryptPdfBytes,
  findEmbeddedMedia,
  groupPagesEveryN,
  groupPagesAtBreaks,
  type PdfDocumentProxy,
  type Annotation,
  type BookmarkNode,
  type DocPage,
  type DocSource,
  type WatermarkOptions,
  type DocumentMetadata,
  type PageNumberingOptions,
  type CompressOptions,
  type EncryptionOptions,
  type EmbeddedMedia,
} from "@folio/engine";
import type { FormFieldDef } from "@folio/engine";
import { ocrPage } from "@folio/engine/ocr";
import { runBackgroundIndexing } from "@/lib/pdf/background-index";
import JSZip from "jszip";
import { saveOrDownloadPdf, saveOrDownloadZip, saveOrDownloadSvg } from "@/lib/electron-bridge";
import { logAuditEvent, getAuditTrail } from "@/lib/pdf/audit-log";
import { deleteAutosave, getAutosave, saveAutosave } from "@/lib/pdf/autosave";
import { generateThumbnail, recordDocumentOpened } from "@/lib/pdf/library";
import { indexLibraryDocument } from "@/lib/pdf/library-index";
import { getAutosaveEnabled, getOcrDenoise, getOcrDeskew, getOcrLanguages } from "@/lib/app-settings";

const AUTOSAVE_INTERVAL_MS = 20_000;

async function readTwoIndependentBuffers(file: File) {
  const forPdfjs = await file.arrayBuffer();
  const forStorage = await file.arrayBuffer();
  return { forPdfjs, forStorage };
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function useEditorDocument() {
  const [fileName, setFileName] = useState<string>("");
  const [pages, setPages] = useState<DocPage[]>([]);
  const [sources, setSources] = useState<Map<string, DocSource>>(new Map());
  const [pdfjsDocs, setPdfjsDocs] = useState<Map<string, PdfDocumentProxy>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [watermark, setWatermark] = useState<WatermarkOptions | null>(null);
  const [encryption, setEncryption] = useState<EncryptionOptions | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{ pageId: string; progress: number } | null>(null);
  const [ocrResult, setOcrResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const clearOcrResult = useCallback(() => setOcrResult(null), []);
  const [passwordPrompt, setPasswordPrompt] = useState<{ wasIncorrect: boolean } | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata>({
    title: "",
    author: "",
    subject: "",
    keywords: [],
  });
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [pageNumbering, setPageNumbering] = useState<PageNumberingOptions | null>(null);
  const [wasSourceEncrypted, setWasSourceEncrypted] = useState(false);
  const [mediaBySource, setMediaBySource] = useState<Map<string, EmbeddedMedia[]>>(new Map());
  const [documentId, setDocumentId] = useState<string>("");
  const isDirty = useRef(false);
  const pendingFileRef = useRef<File | null>(null);

  const finishLoadingFile = useCallback(async (file: File, password?: string) => {
    const forPdfjs = await file.arrayBuffer();
    const pdfjsDoc = await loadPdfDocument(forPdfjs, password);
    let forStorage: ArrayBuffer | Uint8Array = await file.arrayBuffer();
    const sourceId = createId();

    let sourceWasEncrypted = false;
    if (password) {
      try {
        forStorage = await decryptPdfBytes(forStorage, password);
        sourceWasEncrypted = true;
      } catch {
      }
    }

    setFileName(file.name);
    setSources(new Map([[sourceId, { id: sourceId, name: file.name, bytes: forStorage }]]));
    setPdfjsDocs(new Map([[sourceId, pdfjsDoc]]));
    setPages(pagesFromSource(sourceId, pdfjsDoc.numPages));
    isDirty.current = false;
    setIsReady(true);
    setPasswordPrompt(null);
    setBookmarks([]);
    setWasSourceEncrypted(sourceWasEncrypted);
    setDocumentId(sourceId);
    pendingFileRef.current = null;
    logAuditEvent(sourceId, file.name, "opened", `Opened "${file.name}"`);

    findEmbeddedMedia(forStorage)
      .then((media) => setMediaBySource(new Map([[sourceId, media]])))
      .catch(() => setMediaBySource(new Map()));

    generateThumbnail(pdfjsDoc)
      .then((thumbnailDataUrl) =>
        recordDocumentOpened({
          name: file.name,
          sizeBytes: file.size,
          bytes: forStorage instanceof Uint8Array ? forStorage : new Uint8Array(forStorage),
          pageCount: pdfjsDoc.numPages,
          thumbnailDataUrl,
        })
      )
      .then((record) => indexLibraryDocument(record.id))
      .catch(() => {});

    try {
      const { info } = await pdfjsDoc.getMetadata();
      const i = info as Record<string, string | undefined>;
      setMetadata({
        title: i.Title ?? "",
        author: i.Author ?? "",
        subject: i.Subject ?? "",
        keywords: i.Keywords ? i.Keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
      });
    } catch {
      setMetadata({ title: "", author: "", subject: "", keywords: [] });
    }
  }, []);

  const loadInitialFile = useCallback(
    async (file: File) => {
      setIsReady(false);
      try {
        await finishLoadingFile(file);
      } catch (err) {
        if (err instanceof PdfPasswordRequiredError) {
          pendingFileRef.current = file;
          setPasswordPrompt({ wasIncorrect: err.wasIncorrect });
          return;
        }
        throw err;
      }
    },
    [finishLoadingFile]
  );

  const retryWithPassword = useCallback(
    async (password: string) => {
      const file = pendingFileRef.current;
      if (!file) return;
      try {
        await finishLoadingFile(file, password);
      } catch (err) {
        if (err instanceof PdfPasswordRequiredError) {
          setPasswordPrompt({ wasIncorrect: err.wasIncorrect });
          return;
        }
        throw err;
      }
    },
    [finishLoadingFile]
  );

  const cancelPasswordPrompt = useCallback(() => {
    pendingFileRef.current = null;
    setPasswordPrompt(null);
  }, []);

  const restoreFromAutosave = useCallback(async (id: string): Promise<boolean> => {
    const record = await getAutosave(id);
    if (!record) return false;

    setIsReady(false);
    const newSources = new Map<string, DocSource>();
    const newDocs = new Map<string, PdfDocumentProxy>();

    for (const src of record.sources) {
      newSources.set(src.id, { id: src.id, name: src.name, bytes: src.bytes });
      try {
        const doc = await loadPdfDocument(toArrayBuffer(src.bytes));
        newDocs.set(src.id, doc);
      } catch {
        // skip a source that can't be reopened without a password
      }
    }

    setFileName(record.fileName);
    setSources(newSources);
    setPdfjsDocs(newDocs);
    setPages(record.pages.filter((p) => newDocs.has(p.sourceId)));
    setWatermark(record.watermark);
    setEncryption(record.encryption);
    setMetadata(record.metadata);
    setBookmarks(record.bookmarks);
    setPageNumbering(record.pageNumbering);
    setWasSourceEncrypted(false);
    setDocumentId(record.id);
    isDirty.current = true;
    setIsReady(true);

    for (const src of record.sources) {
      findEmbeddedMedia(src.bytes)
        .then((media) => setMediaBySource((prev) => new Map(prev).set(src.id, media)))
        .catch(() => {});
    }

    return true;
  }, []);

  const addFileAtEnd = useCallback(async (file: File) => {
    const { forPdfjs, forStorage } = await readTwoIndependentBuffers(file);
    const pdfjsDoc = await loadPdfDocument(forPdfjs);
    const sourceId = createId();

    setSources((prev) => new Map(prev).set(sourceId, { id: sourceId, name: file.name, bytes: forStorage }));
    setPdfjsDocs((prev) => new Map(prev).set(sourceId, pdfjsDoc));
    setPages((prev) => [...prev, ...pagesFromSource(sourceId, pdfjsDoc.numPages)]);
    isDirty.current = true;

    findEmbeddedMedia(forStorage)
      .then((media) => setMediaBySource((prev) => new Map(prev).set(sourceId, media)))
      .catch(() => {});
  }, []);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    isDirty.current = true;
  }, []);

  const rotatePage = useCallback((pageId: string, deltaDeg: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId ? { ...p, rotation: (((p.rotation + deltaDeg) % 360) + 360) % 360 } : p
      )
    );
    isDirty.current = true;
  }, []);

  const deletePage = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    isDirty.current = true;
  }, []);

  const duplicatePage = useCallback((pageId: string) => {
    setPages((prev) => {
      const index = prev.findIndex((p) => p.id === pageId);
      if (index === -1) return prev;
      const clone: DocPage = {
        ...prev[index],
        id: createId(),
        annotations: prev[index].annotations.map((a) => ({ ...a, id: createId() })),
      };
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
    isDirty.current = true;
  }, []);

  const addAnnotation = useCallback((pageId: string, annotation: Annotation) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, annotations: [...p.annotations, annotation] } : p))
    );
    isDirty.current = true;
  }, []);

  const updateAnnotation = useCallback(
    (pageId: string, annotationId: string, patch: Partial<Annotation>) => {
      setPages((prev) =>
        prev.map((p) =>
          p.id !== pageId
            ? p
            : {
                ...p,
                annotations: p.annotations.map((a) =>
                  a.id === annotationId ? ({ ...a, ...patch } as Annotation) : a
                ),
              }
        )
      );
      isDirty.current = true;
    },
    []
  );

  const setFormFieldValue = useCallback((pageId: string, field: FormFieldDef, value: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;

        if (field.kind === "radio") {
          const others = p.annotations.filter(
            (a) => !(a.type === "form-field" && a.fieldName === field.fieldName)
          );
          const isSelecting = value !== "";
          return {
            ...p,
            annotations: isSelecting
              ? [
                  ...others,
                  {
                    id: createId(),
                    type: "form-field",
                    fieldName: field.fieldName,
                    fieldKind: "radio",
                    x: field.x,
                    y: field.y,
                    width: field.width,
                    height: field.height,
                    value,
                  },
                ]
              : others,
          };
        }

        const existingIndex = p.annotations.findIndex(
          (a) => a.type === "form-field" && a.fieldName === field.fieldName
        );
        const entry: Annotation = {
          id: existingIndex >= 0 ? p.annotations[existingIndex].id : createId(),
          type: "form-field",
          fieldName: field.fieldName,
          fieldKind: field.kind === "checkbox" ? "checkbox" : field.kind === "select" ? "select" : "text",
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          value,
        };

        if (existingIndex >= 0) {
          const next = [...p.annotations];
          next[existingIndex] = entry;
          return { ...p, annotations: next };
        }
        return { ...p, annotations: [...p.annotations, entry] };
      })
    );
    isDirty.current = true;
  }, []);

  const deleteAnnotation = useCallback((pageId: string, annotationId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, annotations: p.annotations.filter((a) => a.id !== annotationId) }
          : p
      )
    );
    isDirty.current = true;
  }, []);

  const exportAndDownload = useCallback(async () => {
    await logAuditEvent(documentId, fileName, "exported", `Exported "${fileName}"`);
    const auditTrail = { fileName, events: await getAuditTrail(documentId) };
    const bytes = await exportDocument(pages, sources, pdfjsDocs, {
      watermark,
      encryption,
      metadata,
      bookmarks,
      pageNumbering,
      auditTrail,
    });
    await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-edited.pdf");
    // A completed export is a clean checkpoint — no need to recover from crash anymore.
    deleteAutosave(documentId).catch(() => {});
  }, [pages, sources, pdfjsDocs, watermark, encryption, metadata, bookmarks, pageNumbering, fileName, documentId]);

  const exportCurrentBytes = useCallback(async () => {
    return exportDocument(pages, sources, pdfjsDocs, { watermark, encryption, metadata, bookmarks, pageNumbering });
  }, [pages, sources, pdfjsDocs, watermark, encryption, metadata, bookmarks, pageNumbering]);

  const scrubAndDownload = useCallback(async () => {
    const bytes = await exportDocument(pages, sources, pdfjsDocs, { scrubMetadata: true });
    await logAuditEvent(documentId, fileName, "metadata-scrubbed", "Removed all metadata and downloaded a clean copy");
    await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-scrubbed.pdf");
  }, [pages, sources, pdfjsDocs, fileName, documentId]);

  const secureShareDownload = useCallback(
    async (password: string) => {
      const bytes = await exportDocument(pages, sources, pdfjsDocs, {
        watermark,
        metadata,
        bookmarks,
        pageNumbering,
        encryption: {
          userPassword: password,
          ownerPassword: password,
          permissions: { printing: true, copying: true, modifying: false, annotating: true },
          aesKeyBits: 256,
        },
      });
      await logAuditEvent(documentId, fileName, "encrypted", "Created a password-protected copy for secure sharing");
      await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-secure.pdf");
    },
    [pages, sources, pdfjsDocs, watermark, metadata, bookmarks, pageNumbering, fileName, documentId]
  );

  const saveUnlockedCopy = useCallback(async () => {
    const bytes = await exportDocument(pages, sources, pdfjsDocs, {
      watermark,
      encryption: null,
      metadata,
      bookmarks,
      pageNumbering,
    });
    await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-unlocked.pdf");
  }, [pages, sources, pdfjsDocs, watermark, metadata, bookmarks, pageNumbering, fileName]);

  const exportCompressedCopy = useCallback(
    async (options: CompressOptions) => {
      const bytes = await exportDocument(pages, sources, pdfjsDocs, {
        watermark,
        encryption,
        metadata,
        bookmarks,
        pageNumbering,
        compress: options,
      });
      await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-compressed.pdf");
    },
    [pages, sources, pdfjsDocs, watermark, encryption, metadata, bookmarks, pageNumbering, fileName]
  );

  const exportPageSvg = useCallback(
    async (pageId: string) => {
      const docPage = pages.find((p) => p.id === pageId);
      const doc = docPage && pdfjsDocs.get(docPage.sourceId);
      if (!docPage || !doc) return;
      const svg = await exportPageAsSvg(doc, docPage);
      const pageNumber = pages.findIndex((p) => p.id === pageId) + 1;
      await saveOrDownloadSvg(svg, fileName.replace(/\.pdf$/i, "") + `-page${pageNumber}.svg`);
    },
    [pages, pdfjsDocs, fileName]
  );

  const extractAndDownload = useCallback(
    async (pageIds: string[]) => {
      const bytes = await extractPagesAsPdf(pageIds, pages, sources, pdfjsDocs);
      await saveOrDownloadPdf(bytes, fileName.replace(/\.pdf$/i, "") + "-extract.pdf");
    },
    [pages, sources, pdfjsDocs, fileName]
  );

  const splitDocument = useCallback(
    async (mode: "everyN" | "atBreaks", value: number | number[]) => {
      const groups =
        mode === "everyN"
          ? groupPagesEveryN(pages, value as number)
          : groupPagesAtBreaks(pages, value as number[]);

      const baseName = fileName.replace(/\.pdf$/i, "");

      if (groups.length === 1) {
        const bytes = await exportDocument(groups[0], sources, pdfjsDocs);
        await saveOrDownloadPdf(bytes, `${baseName}-part1.pdf`);
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < groups.length; i++) {
        const bytes = await exportDocument(groups[i], sources, pdfjsDocs);
        zip.file(`${baseName}-part${i + 1}.pdf`, bytes);
      }
      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      await saveOrDownloadZip(zipBytes, `${baseName}-split.zip`);
    },
    [pages, sources, pdfjsDocs, fileName]
  );

  const runOcr = useCallback(
    async (pageId: string): Promise<{ ok: boolean; wordCount: number; error?: string }> => {
      const docPage = pages.find((p) => p.id === pageId);
      const doc = docPage && pdfjsDocs.get(docPage.sourceId);
      if (!docPage || !doc) return { ok: false, wordCount: 0, error: "Page not found." };

      setOcrProgress({ pageId, progress: 0 });
      try {
        const words = await ocrPage(
          doc,
          docPage.sourcePageIndex,
          docPage.rotation,
          { languages: getOcrLanguages(), deskew: getOcrDeskew(), denoise: getOcrDenoise() },
          (progress) => setOcrProgress({ pageId, progress })
        );
        setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ocrWords: words } : p)));
        isDirty.current = true;
        return { ok: true, wordCount: words.length };
      } catch (err) {
        return { ok: false, wordCount: 0, error: err instanceof Error ? err.message : String(err) };
      } finally {
        setOcrProgress(null);
      }
    },
    [pages, pdfjsDocs]
  );

  const runOcrAll = useCallback(async () => {
    setOcrResult(null);
    let successCount = 0;
    let totalWords = 0;
    let firstError: string | null = null;

    for (const p of pages) {
      const result = await runOcr(p.id);
      if (result.ok) {
        successCount++;
        totalWords += result.wordCount;
      } else if (!firstError) {
        firstError = result.error ?? "Unknown error.";
      }
    }

    if (pages.length === 0) {
      setOcrResult({ status: "error", message: "No pages to make searchable." });
    } else if (successCount === 0) {
      setOcrResult({ status: "error", message: `OCR failed${firstError ? `: ${firstError}` : "."}` });
    } else if (successCount < pages.length) {
      setOcrResult({
        status: "success",
        message: `Made ${successCount} of ${pages.length} pages searchable (${totalWords} words found) — ${pages.length - successCount} page${pages.length - successCount === 1 ? "" : "s"} failed${firstError ? `: ${firstError}` : ""}`,
      });
    } else {
      setOcrResult({
        status: "success",
        message: `Made ${successCount} page${successCount === 1 ? "" : "s"} searchable (${totalWords} words found)`,
      });
    }
  }, [pages, runOcr]);

  useEffect(() => {
    if (!isReady || pages.length === 0) return;
    const cancel = runBackgroundIndexing(pages, pdfjsDocs, (pageId, words) => {
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ocrWords: words } : p)));
      isDirty.current = true;
    });
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, isReady]);

  const autosaveInputsRef = useRef({
    fileName,
    sources,
    pages,
    watermark,
    encryption,
    metadata,
    bookmarks,
    pageNumbering,
    documentId,
  });
  useEffect(() => {
    autosaveInputsRef.current = {
      fileName,
      sources,
      pages,
      watermark,
      encryption,
      metadata,
      bookmarks,
      pageNumbering,
      documentId,
    };
  });

  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(() => {
      if (!isDirty.current || !getAutosaveEnabled()) return;
      const snapshot = autosaveInputsRef.current;
      const sourceRecords = Array.from(snapshot.sources.values()).map((s) => ({
        id: s.id,
        name: s.name,
        bytes: s.bytes instanceof Uint8Array ? s.bytes : new Uint8Array(s.bytes),
      }));
      saveAutosave({
        id: snapshot.documentId,
        fileName: snapshot.fileName,
        timestamp: Date.now(),
        sources: sourceRecords,
        pages: snapshot.pages,
        watermark: snapshot.watermark,
        encryption: snapshot.encryption,
        metadata: snapshot.metadata,
        bookmarks: snapshot.bookmarks,
        pageNumbering: snapshot.pageNumbering,
      }).then(() => {
        isDirty.current = false;
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isReady, documentId]);

  const getPdfjsPage = useCallback(
    async (docPage: DocPage) => {
      const doc = pdfjsDocs.get(docPage.sourceId);
      if (!doc) return null;
      return doc.getPage(docPage.sourcePageIndex + 1);
    },
    [pdfjsDocs]
  );

  return useMemo(
    () => ({
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
      getPdfjsPage,
      watermark,
      setWatermark,
      encryption,
      setEncryption,
      ocrProgress,
      ocrResult,
      clearOcrResult,
      runOcr,
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
    }),
    [
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
      getPdfjsPage,
      watermark,
      encryption,
      ocrProgress,
      ocrResult,
      clearOcrResult,
      runOcr,
      runOcrAll,
      passwordPrompt,
      retryWithPassword,
      cancelPasswordPrompt,
      metadata,
      bookmarks,
      pageNumbering,
      splitDocument,
      wasSourceEncrypted,
      saveUnlockedCopy,
      mediaBySource,
      documentId,
    ]
  );
}

export type EditorDocument = ReturnType<typeof useEditorDocument>;
