import { idbDelete, idbGetAll, idbPut } from "./idb";
import { certInfo, type CertBundle, type StoredCertMeta } from "@folio/engine/signing";

type StoredCertRecord = StoredCertMeta & {
  salt: string;
  iv: string;
  ciphertext: string;
};

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function unhex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Folio's own certificate store — encrypted-at-rest in IndexedDB, keyed by a user-chosen passphrase. */
export async function saveCertificate(label: string, bundle: CertBundle, passphrase: string): Promise<StoredCertMeta> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext));

  const info = certInfo(bundle.certPem);
  const record: StoredCertRecord = {
    id: crypto.randomUUID(),
    label,
    ...info,
    createdAt: Date.now(),
    salt: hex(salt),
    iv: hex(iv),
    ciphertext: hex(ciphertext),
  };
  await idbPut("certificates", record);
  const { salt: _s, iv: _i, ciphertext: _c, ...meta } = record;
  void _s;
  void _i;
  void _c;
  return meta;
}

export async function listCertificates(): Promise<StoredCertMeta[]> {
  const records = await idbGetAll<StoredCertRecord>("certificates");
  return records
    .map(({ salt: _s, iv: _i, ciphertext: _c, ...meta }) => {
      void _s;
      void _i;
      void _c;
      return meta;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadCertificateBundle(id: string, passphrase: string): Promise<CertBundle> {
  const records = await idbGetAll<StoredCertRecord>("certificates");
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error("Certificate not found.");

  const key = await deriveAesKey(passphrase, unhex(record.salt));
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unhex(record.iv) as BufferSource },
      key,
      unhex(record.ciphertext) as BufferSource
    );
  } catch {
    throw new Error("Wrong passphrase.");
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as CertBundle;
}

export async function deleteCertificate(id: string): Promise<void> {
  await idbDelete("certificates", id);
}
