import {
  PDFDict,
  PDFArray,
  PDFName,
  PDFHexString,
  PDFString,
  PDFStream,
  PDFRawStream,
  PDFNumber,
  PDFBool,
  type PDFContext,
  type PDFDocument,
} from "pdf-lib";
import { bytesToHex, aesCbcEncryptWithRandomIv } from "./crypto-primitives";
import {
  computeOwnerValue,
  computeEncryptionKey,
  computeUserValue,
  computeUserValueR6,
  computeOwnerValueR6,
  computePermsR6,
  deriveObjectKey,
  computePermissionsBitmask,
  type PermissionFlags,
} from "./pdf-standard-security";

export type EncryptionOptions = {
  userPassword: string;
  ownerPassword: string;
  permissions: PermissionFlags;
  /** AES key size. 128 produces the original V4/R4 handler; 256 produces V5/R6 (ISO 32000-2). */
  aesKeyBits?: 128 | 256;
};

async function encryptStringOrHexValue(
  value: PDFString | PDFHexString,
  objectKey: Uint8Array
): Promise<PDFHexString> {
  const plaintext = value.asBytes();
  const ciphertext = await aesCbcEncryptWithRandomIv(objectKey, plaintext);
  return PDFHexString.of(bytesToHex(ciphertext));
}

async function encryptContainerStringsRecursively(
  container: PDFDict | PDFArray,
  objectKey: Uint8Array
): Promise<void> {
  if (container instanceof PDFDict) {
    for (const key of container.keys()) {
      const value = container.get(key);
      if (value instanceof PDFString || value instanceof PDFHexString) {
        container.set(key, await encryptStringOrHexValue(value, objectKey));
      } else if ((value instanceof PDFDict || value instanceof PDFArray) && !(value instanceof PDFStream)) {
        await encryptContainerStringsRecursively(value, objectKey);
      }
    }
  } else {
    for (let i = 0; i < container.size(); i++) {
      const value = container.get(i);
      if (value instanceof PDFString || value instanceof PDFHexString) {
        container.set(i, await encryptStringOrHexValue(value, objectKey));
      } else if ((value instanceof PDFDict || value instanceof PDFArray) && !(value instanceof PDFStream)) {
        await encryptContainerStringsRecursively(value, objectKey);
      }
    }
  }
}

/**
 * Encrypts every string and stream in place (Standard Security Handler R4, AES-128/AESV2 —
 * ISO 32000-1 §7.6), then registers /Encrypt and sets the trailer's /ID. Requires a document
 * saved with `useObjectStreams: false`.
 */
export async function encryptDocument(doc: PDFDocument, options: EncryptionOptions): Promise<void> {
  const context: PDFContext = doc.context;
  const aesKeyBits = options.aesKeyBits ?? 128;

  const idBytes = crypto.getRandomValues(new Uint8Array(16));
  const idHex = bytesToHex(idBytes);
  context.trailerInfo.ID = context.obj([PDFHexString.of(idHex), PDFHexString.of(idHex)]);

  const permissions = computePermissionsBitmask(options.permissions);

  // For R6/AES-256 the file encryption key is random and the password only wraps it
  // (Algorithms 8/9) — no per-object Algorithm 1 derivation, unlike R4.
  const fileKey =
    aesKeyBits === 256
      ? crypto.getRandomValues(new Uint8Array(32))
      : (() => {
          const ownerValue = computeOwnerValue(options.ownerPassword, options.userPassword);
          return computeEncryptionKey(options.userPassword, ownerValue, permissions, idBytes);
        })();

  const indirectObjects = context.enumerateIndirectObjects();

  for (const [ref, obj] of indirectObjects) {
    const objectKey =
      aesKeyBits === 256 ? fileKey : deriveObjectKey(fileKey, ref.objectNumber, ref.generationNumber, true);

    if (obj instanceof PDFStream) {
      const plaintext = obj.getContents();
      const ciphertext = await aesCbcEncryptWithRandomIv(objectKey, plaintext);

      const dict = obj.dict;
      dict.set(PDFName.of("Length"), PDFNumber.of(ciphertext.length));
      context.assign(ref, PDFRawStream.of(dict, ciphertext));

      await encryptContainerStringsRecursively(dict, objectKey);
    } else if (obj instanceof PDFDict || obj instanceof PDFArray) {
      await encryptContainerStringsRecursively(obj, objectKey);
    } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
      context.assign(ref, await encryptStringOrHexValue(obj, objectKey));
    }
  }

  const encryptDict =
    aesKeyBits === 256
      ? (() => {
          const { u, ue } = computeUserValueR6(options.userPassword, fileKey);
          const { o, oe } = computeOwnerValueR6(options.ownerPassword, options.userPassword, u, fileKey);
          const perms = computePermsR6(permissions, true, fileKey);
          return context.obj({
            Filter: "Standard",
            V: 5,
            R: 6,
            Length: 256,
            CF: {
              StdCF: {
                AuthEvent: "DocOpen",
                CFM: "AESV3",
                Length: 32,
              },
            },
            StmF: "StdCF",
            StrF: "StdCF",
            O: PDFHexString.of(bytesToHex(o)),
            U: PDFHexString.of(bytesToHex(u)),
            OE: PDFHexString.of(bytesToHex(oe)),
            UE: PDFHexString.of(bytesToHex(ue)),
            Perms: PDFHexString.of(bytesToHex(perms)),
            P: PDFNumber.of(permissions),
            EncryptMetadata: PDFBool.True,
          });
        })()
      : (() => {
          const ownerValue = computeOwnerValue(options.ownerPassword, options.userPassword);
          const userValue = computeUserValue(fileKey, idBytes);
          return context.obj({
            Filter: "Standard",
            V: 4,
            R: 4,
            Length: 128,
            CF: {
              StdCF: {
                AuthEvent: "DocOpen",
                CFM: "AESV2",
                Length: 16,
              },
            },
            StmF: "StdCF",
            StrF: "StdCF",
            O: PDFHexString.of(bytesToHex(ownerValue)),
            U: PDFHexString.of(bytesToHex(userValue)),
            P: PDFNumber.of(permissions),
            EncryptMetadata: PDFBool.True,
          });
        })();

  const encryptRef = context.register(encryptDict);
  context.trailerInfo.Encrypt = encryptRef;
}
