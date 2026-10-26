import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { getEngineConfig, onEngineConfigChange } from "./config";

function applyWorkerSrc() {
  if (typeof window === "undefined") return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = getEngineConfig().pdfWorkerSrc;
}

let workerConfigured = false;
onEngineConfigChange(() => {
  if (workerConfigured) applyWorkerSrc();
});

export { pdfjsLib };
export type PdfDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PdfPageProxy = pdfjsLib.PDFPageProxy;

export class PdfPasswordRequiredError extends Error {
  constructor(public wasIncorrect: boolean) {
    super(wasIncorrect ? "Incorrect password" : "Password required");
  }
}

export async function loadPdfDocument(source: ArrayBuffer, password?: string): Promise<PdfDocumentProxy> {
  if (!workerConfigured) {
    applyWorkerSrc();
    workerConfigured = true;
  }
  try {
    const loadingTask = pdfjsLib.getDocument({ data: source, password, stopAtErrors: false });
    return await loadingTask.promise;
  } catch (err) {
    if (err instanceof pdfjsLib.PasswordException) {
      const wasIncorrect = err.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
      throw new PdfPasswordRequiredError(wasIncorrect);
    }
    throw err;
  }
}
