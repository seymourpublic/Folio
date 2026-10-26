import { concatBytes, md5, rc4, sha256, sha384, sha512, aesCbcNoPadding, aesEcbNoPadding } from "./crypto-primitives";

// ISO 32000-1 §7.6.3.3, Algorithm 2's fixed 32-byte padding string.
const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e,
  0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

export const KEY_LENGTH_BYTES = 16; // 128-bit (Revision 4)

export function padPassword(password: string): Uint8Array {
  const encoded = new TextEncoder().encode(password).slice(0, 32);
  const result = new Uint8Array(32);
  result.set(encoded);
  if (encoded.length < 32) result.set(PADDING.slice(0, 32 - encoded.length), encoded.length);
  return result;
}

function permissionsToBytes(permissions: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, permissions, true);
  return new Uint8Array(buf);
}

/** Algorithm 3: computes the /O (owner) value. */
export function computeOwnerValue(ownerPassword: string, userPassword: string): Uint8Array {
  let hash = md5(padPassword(ownerPassword || userPassword));
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, KEY_LENGTH_BYTES));
  const rc4Key = hash.slice(0, KEY_LENGTH_BYTES);

  let output = rc4(rc4Key, padPassword(userPassword));
  for (let round = 1; round <= 19; round++) {
    const roundKey = rc4Key.map((b) => b ^ round);
    output = rc4(roundKey, output);
  }
  return output; // 32 bytes
}

/** Algorithm 2: computes the file encryption key from the user password. */
export function computeEncryptionKey(
  userPassword: string,
  ownerValue: Uint8Array,
  permissions: number,
  idBytes: Uint8Array
): Uint8Array {
  let hash = md5(concatBytes(padPassword(userPassword), ownerValue, permissionsToBytes(permissions), idBytes));
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, KEY_LENGTH_BYTES));
  return hash.slice(0, KEY_LENGTH_BYTES);
}

/** Algorithm 5: computes the /U (user) value for revisions 3/4. */
export function computeUserValue(encryptionKey: Uint8Array, idBytes: Uint8Array): Uint8Array {
  const hash = md5(concatBytes(PADDING, idBytes));
  let output = rc4(encryptionKey, hash);
  for (let round = 1; round <= 19; round++) {
    const roundKey = encryptionKey.map((b) => b ^ round);
    output = rc4(roundKey, output);
  }
  const result = new Uint8Array(32);
  result.set(output, 0);
  return result;
}

/** Algorithm 1 / 1.A: derives the per-object encryption key. */
export function deriveObjectKey(fileKey: Uint8Array, objectNumber: number, generationNumber: number, isAES: boolean): Uint8Array {
  const objBytes = new Uint8Array([objectNumber & 0xff, (objectNumber >> 8) & 0xff, (objectNumber >> 16) & 0xff]);
  const genBytes = new Uint8Array([generationNumber & 0xff, (generationNumber >> 8) & 0xff]);
  const parts = isAES
    ? concatBytes(fileKey, objBytes, genBytes, new Uint8Array([0x73, 0x41, 0x6c, 0x54]))
    : concatBytes(fileKey, objBytes, genBytes);
  const hash = md5(parts);
  const n = Math.min(fileKey.length + 5, 16);
  return hash.slice(0, n);
}

// --- AES-256 (V5/R6, ISO 32000-2 §7.6.4) ---
// The file encryption key is random, not password-derived; Algorithms 8/9 wrap it.

const R6_PASSWORD_MAX_BYTES = 127;

function truncatePassword(password: string): Uint8Array {
  return new TextEncoder().encode(password).slice(0, R6_PASSWORD_MAX_BYTES);
}

/** ISO 32000-2 Algorithm 2.B: the iterated/"hardened" hash used throughout R6. */
export function computeHardenedHash(passwordBytes: Uint8Array, salt: Uint8Array, userKey: Uint8Array): Uint8Array {
  let k = sha256(concatBytes(passwordBytes, salt, userKey));
  let round = 0;

  while (true) {
    const roundInput = concatBytes(passwordBytes, k, userKey);
    const k1Parts: Uint8Array[] = [];
    for (let i = 0; i < 64; i++) k1Parts.push(roundInput);
    const k1 = concatBytes(...k1Parts);

    const e = aesCbcNoPadding(k.slice(0, 16), k.slice(16, 32), k1, "encrypt");

    let sum = 0;
    for (let i = 0; i < 16; i++) sum += e[i];
    const mod = sum % 3;
    k = mod === 0 ? sha256(e) : mod === 1 ? sha384(e) : sha512(e);

    round++;
    if (round >= 64 && e[e.length - 1] <= round - 32) break;
  }

  return k.slice(0, 32);
}

/** Algorithm 8: computes the 48-byte /U value and the /UE value for R6. */
export function computeUserValueR6(
  userPassword: string,
  fileEncryptionKey: Uint8Array
): { u: Uint8Array; ue: Uint8Array } {
  const passwordBytes = truncatePassword(userPassword);
  const validationSalt = crypto.getRandomValues(new Uint8Array(8));
  const keySalt = crypto.getRandomValues(new Uint8Array(8));

  const validationHash = computeHardenedHash(passwordBytes, validationSalt, new Uint8Array(0));
  const u = concatBytes(validationHash, validationSalt, keySalt);

  const intermediateKey = computeHardenedHash(passwordBytes, keySalt, new Uint8Array(0));
  const ue = aesCbcNoPadding(intermediateKey, new Uint8Array(16), fileEncryptionKey, "encrypt");

  return { u, ue };
}

/** Algorithm 9: computes the 48-byte /O value and the /OE value for R6. */
export function computeOwnerValueR6(
  ownerPassword: string,
  userPassword: string,
  uValue: Uint8Array,
  fileEncryptionKey: Uint8Array
): { o: Uint8Array; oe: Uint8Array } {
  const passwordBytes = truncatePassword(ownerPassword || userPassword);
  const validationSalt = crypto.getRandomValues(new Uint8Array(8));
  const keySalt = crypto.getRandomValues(new Uint8Array(8));

  const validationHash = computeHardenedHash(passwordBytes, validationSalt, uValue);
  const o = concatBytes(validationHash, validationSalt, keySalt);

  const intermediateKey = computeHardenedHash(passwordBytes, keySalt, uValue);
  const oe = aesCbcNoPadding(intermediateKey, new Uint8Array(16), fileEncryptionKey, "encrypt");

  return { o, oe };
}

/** Recovers the file encryption key from /UE given a candidate user password; Algorithm 2.A reversed. */
export function recoverFileKeyFromUserPassword(
  userPassword: string,
  uValue: Uint8Array,
  ueValue: Uint8Array
): { fileKey: Uint8Array; isCorrect: boolean } {
  const passwordBytes = truncatePassword(userPassword);
  const validationSalt = uValue.slice(32, 40);
  const keySalt = uValue.slice(40, 48);

  const validationHash = computeHardenedHash(passwordBytes, validationSalt, new Uint8Array(0));
  const isCorrect = bytesEqual32(validationHash, uValue.slice(0, 32));

  const intermediateKey = computeHardenedHash(passwordBytes, keySalt, new Uint8Array(0));
  const fileKey = aesCbcNoPadding(intermediateKey, new Uint8Array(16), ueValue, "decrypt");

  return { fileKey, isCorrect };
}

function bytesEqual32(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Builds the (encrypted) 16-byte /Perms entry required alongside R6's /O and /U. */
export function computePermsR6(
  permissions: number,
  encryptMetadata: boolean,
  fileEncryptionKey: Uint8Array
): Uint8Array {
  const block = new Uint8Array(16);
  new DataView(block.buffer).setInt32(0, permissions, true);
  block[4] = 0xff;
  block[5] = 0xff;
  block[6] = 0xff;
  block[7] = 0xff;
  block[8] = encryptMetadata ? 0x54 : 0x46; // 'T' / 'F'
  block[9] = 0x61; // "adb"
  block[10] = 0x64;
  block[11] = 0x62;
  block.set(crypto.getRandomValues(new Uint8Array(4)), 12);
  return aesEcbNoPadding(fileEncryptionKey, block, "encrypt");
}

export type PermissionFlags = {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
  annotating: boolean;
};

function setBit(bits: number, bitIndex: number, value: boolean): number {
  return value ? bits | (1 << bitIndex) : bits & ~(1 << bitIndex);
}

/** Builds the 32-bit /P permissions value (Table 22, ISO 32000-1 §7.6.3.2). */
export function computePermissionsBitmask(perms: PermissionFlags): number {
  let bits = 0xffffffff;
  bits &= ~(1 << 0); // bit 1 reserved, must be 0
  bits &= ~(1 << 1); // bit 2 reserved, must be 0
  bits = setBit(bits, 2, perms.printing); // bit 3: print
  bits = setBit(bits, 3, perms.modifying); // bit 4: modify contents
  bits = setBit(bits, 4, perms.copying); // bit 5: copy/extract
  bits = setBit(bits, 5, perms.annotating); // bit 6: annotate / fill forms
  bits = setBit(bits, 8, perms.annotating); // bit 9: fill form fields
  bits = setBit(bits, 9, true); // bit 10: extract for accessibility — always allowed
  bits = setBit(bits, 10, perms.modifying); // bit 11: assemble document
  bits = setBit(bits, 11, perms.printing); // bit 12: high-quality printing
  return bits | 0;
}
