/** SimHash (Charikar 2002) — a locality-sensitive hash whose fingerprints differ in only a
 * few bits for near-duplicate texts. Uses `BigInt(...)` calls rather than `123n` literals:
 * the project's ES2017 target disallows the literal syntax. */

const ONE = BigInt(1);
const ZERO = BigInt(0);
const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const FNV_OFFSET_BASIS = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");

const FINGERPRINT_BITS = 64;
const SHINGLE_SIZE = 3; // 3-word shingles balance sensitivity vs. noise from word order

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function shingles(words: string[]): string[] {
  if (words.length < SHINGLE_SIZE) return words;
  const result: string[] = [];
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    result.push(words.slice(i, i + SHINGLE_SIZE).join(" "));
  }
  return result;
}

/** FNV-1a — fast and well-distributed; SimHash's bit voting needs dispersion, not crypto. */
function fnv1a64(str: string): bigint {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/** Computes a 64-bit SimHash fingerprint: hashes every 3-word shingle, then takes a
 * weighted per-bit vote across those hashes. */
export function computeSimHash(text: string): bigint {
  const words = tokenize(text);
  if (words.length === 0) return ZERO;

  const grams = shingles(words);
  const weights = new Array<number>(FINGERPRINT_BITS).fill(0);

  for (const gram of grams) {
    const h = fnv1a64(gram);
    for (let bit = 0; bit < FINGERPRINT_BITS; bit++) {
      const isSet = (h >> BigInt(bit)) & ONE;
      weights[bit] += isSet ? 1 : -1;
    }
  }

  let fingerprint = ZERO;
  for (let bit = 0; bit < FINGERPRINT_BITS; bit++) {
    if (weights[bit] > 0) fingerprint |= ONE << BigInt(bit);
  }
  return fingerprint;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > ZERO) {
    count += Number(x & ONE);
    x >>= ONE;
  }
  return count;
}
