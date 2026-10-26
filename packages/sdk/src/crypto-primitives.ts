import CryptoJS from "crypto-js";

export function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return CryptoJS.enc.Latin1.parse(binary);
}

export function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const { words, sigBytes } = wordArray;
  const bytes = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    bytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}

export function md5(bytes: Uint8Array): Uint8Array {
  return wordArrayToBytes(CryptoJS.MD5(bytesToWordArray(bytes)));
}

export function sha256(bytes: Uint8Array): Uint8Array {
  return wordArrayToBytes(CryptoJS.SHA256(bytesToWordArray(bytes)));
}

export function sha384(bytes: Uint8Array): Uint8Array {
  return wordArrayToBytes(CryptoJS.SHA384(bytesToWordArray(bytes)));
}

export function sha512(bytes: Uint8Array): Uint8Array {
  return wordArrayToBytes(CryptoJS.SHA512(bytesToWordArray(bytes)));
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const encrypted = CryptoJS.RC4.encrypt(bytesToWordArray(data), bytesToWordArray(key));
  return wordArrayToBytes(encrypted.ciphertext);
}

/**
 * No-padding AES-CBC, used by the AES-256 (R6) key derivation (ISO 32000-2 Algorithm 2.B)
 * and key wrapping (Algorithms 8/9). Web Crypto's AES-CBC always pads, so crypto-js is
 * used instead.
 */
export function aesCbcNoPadding(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  direction: "encrypt" | "decrypt"
): Uint8Array {
  const keyWA = bytesToWordArray(key);
  const ivWA = bytesToWordArray(iv);
  const options = { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding };
  if (direction === "encrypt") {
    const result = CryptoJS.AES.encrypt(bytesToWordArray(data), keyWA, options);
    return wordArrayToBytes(result.ciphertext);
  }
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: bytesToWordArray(data) });
  return wordArrayToBytes(CryptoJS.AES.decrypt(cipherParams, keyWA, options));
}

/** AES-256-ECB, no padding — used only for the R6 /Perms entry (ISO 32000-2 §7.6.4.3.5). */
export function aesEcbNoPadding(
  key: Uint8Array,
  data: Uint8Array,
  direction: "encrypt" | "decrypt"
): Uint8Array {
  const keyWA = bytesToWordArray(key);
  const options = { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding };
  if (direction === "encrypt") {
    const result = CryptoJS.AES.encrypt(bytesToWordArray(data), keyWA, options);
    return wordArrayToBytes(result.ciphertext);
  }
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: bytesToWordArray(data) });
  return wordArrayToBytes(CryptoJS.AES.decrypt(cipherParams, keyWA, options));
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function aesCbcEncryptWithRandomIv(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, data as BufferSource);
  return concatBytes(iv, new Uint8Array(ciphertext));
}

export async function aesCbcDecryptWithPrependedIv(key: Uint8Array, ivPlusCiphertext: Uint8Array): Promise<Uint8Array> {
  if (ivPlusCiphertext.length <= 16) return new Uint8Array(0);
  const iv = ivPlusCiphertext.slice(0, 16);
  const ciphertext = ivPlusCiphertext.slice(16);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext as BufferSource);
  return new Uint8Array(plaintext);
}
