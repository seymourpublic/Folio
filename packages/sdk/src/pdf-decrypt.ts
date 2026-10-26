import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFString,
  PDFStream,
  PDFRawStream,
  PDFNumber,
  type PDFContext,
  type PDFRef,
} from "pdf-lib";

type IndirectObject = ReturnType<PDFContext["enumerateIndirectObjects"]>[number][1];
import { aesCbcDecryptWithPrependedIv, rc4 } from "./crypto-primitives";
import {
  computeEncryptionKey,
  computeUserValue,
  deriveObjectKey,
  recoverFileKeyFromUserPassword,
} from "./pdf-standard-security";

export class UnsupportedEncryptionError extends Error {
  constructor(detail: string) {
    super(`Unsupported encryption: ${detail}`);
  }
}

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Incorrect password");
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array, length: number): boolean {
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function decryptContainerStringsRecursively(
  container: PDFDict | PDFArray,
  objectKey: Uint8Array,
  isAES: boolean
): Promise<void> {
  const entries: [PDFName | number, unknown][] =
    container instanceof PDFDict
      ? container.keys().map((k) => [k, container.get(k)])
      : Array.from({ length: container.size() }, (_, i) => [i, container.get(i)] as [number, unknown]);

  for (const [key, value] of entries) {
    if (value instanceof PDFString || value instanceof PDFHexString) {
      const plaintext = isAES
        ? await aesCbcDecryptWithPrependedIv(objectKey, value.asBytes())
        : rc4(objectKey, value.asBytes());
      const hex = Array.from(plaintext)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (container instanceof PDFDict) container.set(key as PDFName, PDFHexString.of(hex));
      else container.set(key as number, PDFHexString.of(hex));
    } else if ((value instanceof PDFDict || value instanceof PDFArray) && !(value instanceof PDFStream)) {
      await decryptContainerStringsRecursively(value, objectKey, isAES);
    }
  }
}

async function decryptObject(
  context: PDFContext,
  ref: PDFRef,
  obj: IndirectObject,
  objectKey: Uint8Array,
  isAES: boolean
): Promise<void> {
  if (obj instanceof PDFStream) {
    const ciphertext = obj.getContents();
    const plaintext = isAES
      ? await aesCbcDecryptWithPrependedIv(objectKey, ciphertext)
      : rc4(objectKey, ciphertext);

    const dict = obj.dict;
    dict.set(PDFName.of("Length"), PDFNumber.of(plaintext.length));
    context.assign(ref, PDFRawStream.of(dict, plaintext));
    await decryptContainerStringsRecursively(dict, objectKey, isAES);
  } else if (obj instanceof PDFDict || obj instanceof PDFArray) {
    await decryptContainerStringsRecursively(obj, objectKey, isAES);
  } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
    const plaintext = isAES
      ? await aesCbcDecryptWithPrependedIv(objectKey, obj.asBytes())
      : rc4(objectKey, obj.asBytes());
    const hex = Array.from(plaintext)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    context.assign(ref, PDFHexString.of(hex));
  }
}

/** Decrypts a PDF loaded with `{ ignoreEncryption: true }` in place, given the password used to open it. */
export async function decryptDocument(doc: PDFDocument, password: string): Promise<void> {
  const context = doc.context;
  const encryptRef = context.trailerInfo.Encrypt;
  if (!encryptRef) return;

  const encryptDict = context.lookup(encryptRef, PDFDict);
  const v = context.lookupMaybe(encryptDict.get(PDFName.of("V")), PDFNumber)?.asNumber() ?? 0;
  const r = context.lookupMaybe(encryptDict.get(PDFName.of("R")), PDFNumber)?.asNumber() ?? 0;
  const oValue = context.lookup(encryptDict.get(PDFName.of("O")), PDFString, PDFHexString).asBytes();
  const uValue = context.lookup(encryptDict.get(PDFName.of("U")), PDFString, PDFHexString).asBytes();
  const permissions = context.lookup(encryptDict.get(PDFName.of("P")), PDFNumber).asNumber();

  if (v === 5) {
    if (r !== 6) throw new UnsupportedEncryptionError(`R=${r} (only R6 AES-256 is supported for V5)`);
    const cf = context.lookupMaybe(encryptDict.get(PDFName.of("CF")), PDFDict);
    const stdCf = cf ? context.lookupMaybe(cf.get(PDFName.of("StdCF")), PDFDict) : undefined;
    const cfm = stdCf?.get(PDFName.of("CFM"))?.toString();
    if (cfm !== "/AESV3") throw new UnsupportedEncryptionError(`CFM ${cfm ?? "unknown"} (expected AESV3)`);

    const ueValue = context.lookup(encryptDict.get(PDFName.of("UE")), PDFString, PDFHexString).asBytes();
    const { fileKey, isCorrect } = recoverFileKeyFromUserPassword(password, uValue, ueValue);
    if (!isCorrect) throw new IncorrectPasswordError();

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (ref === context.getObjectRef(encryptDict)) continue;
      await decryptObject(context, ref, obj, fileKey, true);
    }

    context.trailerInfo.Encrypt = undefined;
    return;
  }

  let isAES = false;
  if (v === 4) {
    const cf = context.lookupMaybe(encryptDict.get(PDFName.of("CF")), PDFDict);
    const stdCf = cf ? context.lookupMaybe(cf.get(PDFName.of("StdCF")), PDFDict) : undefined;
    const cfm = stdCf?.get(PDFName.of("CFM"))?.toString();
    if (cfm === "/AESV2") isAES = true;
    else if (cfm === "/V2") isAES = false;
    else throw new UnsupportedEncryptionError(`CFM ${cfm ?? "unknown"}`);
  } else if (v !== 1 && v !== 2) {
    throw new UnsupportedEncryptionError(`V=${v} (only V1/V2 RC4, V4 AESV2, and V5 AESV3 are supported)`);
  }
  if (r > 4) throw new UnsupportedEncryptionError(`R=${r} (only R2-R4 are supported here; R5/R6 need V5)`);

  const idArray = context.lookupMaybe(context.trailerInfo.ID, PDFArray);
  const idBytes = idArray ? context.lookup(idArray.get(0), PDFString, PDFHexString).asBytes() : new Uint8Array(0);

  const fileKey = computeEncryptionKey(password, oValue, permissions, idBytes);

  const expectedU = computeUserValue(fileKey, idBytes);
  if (!bytesEqual(expectedU, uValue, 16)) {
    throw new IncorrectPasswordError();
  }

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (ref === context.getObjectRef(encryptDict)) continue;
    const objectKey = deriveObjectKey(fileKey, ref.objectNumber, ref.generationNumber, isAES);
    await decryptObject(context, ref, obj, objectKey, isAES);
  }

  context.trailerInfo.Encrypt = undefined;
}

export async function decryptPdfBytes(bytes: ArrayBuffer | Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (!doc.isEncrypted) return doc.save();
  await decryptDocument(doc, password);
  return doc.save({ useObjectStreams: false });
}
