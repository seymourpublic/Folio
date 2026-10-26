export type DetectedBarcode = { rawValue: string; format: string };

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function isBarcodeDetectionSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

/** Uses the browser's native Shape Detection API (available in Chromium. */
export async function detectBarcodesOnCanvas(canvas: HTMLCanvasElement): Promise<DetectedBarcode[]> {
  if (!isBarcodeDetectionSupported()) return [];
  try {
    const detector = new window.BarcodeDetector!({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "pdf417", "data_matrix", "aztec"],
    });
    const results = await detector.detect(canvas);
    return results.map((r) => ({ rawValue: r.rawValue, format: r.format }));
  } catch {
    return [];
  }
}
