/**
 * Asset-path configuration for the engine's browser-only pieces (pdf.js worker, tesseract.js OCR assets).
 */
export interface EngineConfig {
  /** URL (absolute, or relative to the consumer's app) for the pdf.js worker script. */
  pdfWorkerSrc: string;

  /** Tesseract.js asset paths. */
  tesseract: {
    workerPath?: string;
    corePath?: string;
    langPath?: string;
  };
}

const DEFAULT_PDFJS_VERSION = "6.2.108"; // keep in lockstep with the pdfjs-dist dependency version in package.json

let config: EngineConfig = {
  pdfWorkerSrc: `https://unpkg.com/pdfjs-dist@${DEFAULT_PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  tesseract: {},
};

const listeners = new Set<() => void>();

/**
 * Call this once, before loading any PDF or running OCR, to point the engine at self-hosted worker/asset files.
 */
export function configureEngine(overrides: Partial<EngineConfig>): void {
  config = {
    ...config,
    ...overrides,
    tesseract: { ...config.tesseract, ...overrides.tesseract },
  };
  for (const listener of listeners) listener();
}

export function getEngineConfig(): Readonly<EngineConfig> {
  return config;
}

/** @internal Lets pdfjs.ts re-apply `pdfWorkerSrc` if `configureEngine` is called again after
 * the worker was already configured once. */
export function onEngineConfigChange(listener: () => void): void {
  listeners.add(listener);
}
