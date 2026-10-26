/** Classical (non-ML) image preprocessing for OCR: Otsu binarization for denoise, and a
 * projection-profile skew detector/corrector. Both are well-established, deterministic
 * algorithms — no model, no training data beyond what tesseract itself already needs. */

function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

/** Otsu's method: picks the gray-level threshold that minimizes intra-class variance between
 * the two resulting pixel classes — the standard automatic-threshold algorithm, not a fixed
 * guess, so it adapts to each scan's actual contrast/lighting. */
function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  for (const v of gray) histogram[v]++;
  const total = gray.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

/** Grayscale + Otsu binarization, drawn back onto a new canvas the same size as the input. */
export function denoiseCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, source.width, source.height);
  const gray = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);

  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const outCtx = out.getContext("2d")!;
  const outData = outCtx.createImageData(source.width, source.height);
  for (let p = 0; p < gray.length; p++) {
    const v = gray[p] > threshold ? 255 : 0;
    const i = p * 4;
    outData.data[i] = outData.data[i + 1] = outData.data[i + 2] = v;
    outData.data[i + 3] = 255;
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}

const DESKEW_MAX_ANGLE = 10;
const DESKEW_STEP = 0.5;
const DESKEW_WORK_WIDTH = 500;

function rotatedProjectionVariance(gray: Uint8ClampedArray, width: number, height: number, angleDeg: number): number {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = width / 2;
  const cy = height / 2;

  const rowSums = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x += 2) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = Math.round(cx + dx * cos + dy * sin);
      const sy = Math.round(cy - dx * sin + dy * cos);
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        const v = gray[sy * width + sx];
        if (v < 128) sum++; // dark (ink) pixel
      }
    }
    rowSums[y] = sum;
  }

  const mean = rowSums.reduce((a, b) => a + b, 0) / height;
  let variance = 0;
  for (const s of rowSums) variance += (s - mean) * (s - mean);
  return variance / height;
}

/** Projection-profile deskew: scores candidate angles by how sharply the horizontal
 * projection peaks. Detection runs downscaled; the caller applies the angle full-size. */
export function detectSkewAngle(source: HTMLCanvasElement): number {
  const scale = Math.min(1, DESKEW_WORK_WIDTH / source.width);
  const workWidth = Math.max(1, Math.round(source.width * scale));
  const workHeight = Math.max(1, Math.round(source.height * scale));

  const work = document.createElement("canvas");
  work.width = workWidth;
  work.height = workHeight;
  const workCtx = work.getContext("2d")!;
  workCtx.drawImage(source, 0, 0, workWidth, workHeight);
  const gray = toGrayscale(workCtx.getImageData(0, 0, workWidth, workHeight));

  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let a = -DESKEW_MAX_ANGLE; a <= DESKEW_MAX_ANGLE; a += DESKEW_STEP) {
    const score = rotatedProjectionVariance(gray, workWidth, workHeight, a);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }
  return bestAngle;
}

/** Rotates the full-resolution canvas by `-angleDeg` onto a canvas sized to fit the
 * rotated content without cropping. */
export function rotateCanvas(source: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  if (Math.abs(angleDeg) < 0.05) return source;
  const angle = (-angleDeg * Math.PI) / 180;
  const w = source.width;
  const h = source.height;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const newW = Math.round(w * cos + h * sin);
  const newH = Math.round(w * sin + h * cos);

  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(angle);
  ctx.drawImage(source, -w / 2, -h / 2);
  return out;
}

/** Inverse of the transform `rotateCanvas` applies. */
export function mapRotatedPointToOriginal(
  x: number,
  y: number,
  origWidth: number,
  origHeight: number,
  rotatedWidth: number,
  rotatedHeight: number,
  angleDeg: number
): { x: number; y: number } {
  if (Math.abs(angleDeg) < 0.05) return { x, y };
  const angle = (-angleDeg * Math.PI) / 180; // same angle rotateCanvas used
  const dx = x - rotatedWidth / 2;
  const dy = y - rotatedHeight / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return {
    x: dx * cos - dy * sin + origWidth / 2,
    y: dx * sin + dy * cos + origHeight / 2,
  };
}
