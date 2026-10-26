import forge from "node-forge";
import type { asn1 as forgeAsn1NS } from "node-forge";
import { PDFDict, PDFName, PDFArray, PDFHexString, PDFString, PDFNumber, PDFDocument } from "pdf-lib";
import type { CertBundle } from "./pki";
import {
  DEFAULT_TSA_URL,
  embedTimestampToken,
  parseEmbeddedTimestamp,
  requestTimestamp,
  type TsaTransport,
} from "./rfc3161";

type ForgeAsn1 = forgeAsn1NS.Asn1;

// Reserved space (raw bytes) for the DER-encoded detached PKCS#7 signature. An RFC3161
// timestamp embeds a second CMS SignedData, so that case reserves considerably more.
const RESERVED_SIGNATURE_BYTES = 8192;
const RESERVED_SIGNATURE_BYTES_WITH_TIMESTAMP = 24576;
const CONTENTS_PLACEHOLDER_LEN = (n: number) => n * 2;
const BYTE_RANGE_PLACEHOLDER_NUM = 9_999_999_999;

export type SignOptions = {
  signerName: string;
  reason?: string;
  location?: string;
  contactInfo?: string;
  /**
   * Requests an RFC3161 trusted timestamp for the signature from a TSA and embeds it as an unsigned attribute.
   */
  timestamp?: boolean;
  tsaUrl?: string;
  tsaTransport?: TsaTransport;
};

export type SignResult = { bytes: Uint8Array; signingTime: Date; timestamped: boolean };

function latin1Decode(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function writeAsciiAt(bytes: Uint8Array, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
}

function bytesToForgeBinary(bytes: Uint8Array): string {
  return forge.util.binary.raw.encode(bytes);
}

/**
 * Signs an exported PDF with the incremental byte-range technique (ISO 32000-1 §12.8):
 * reserve /ByteRange and /Contents placeholders, hash everything outside /Contents, sign
 * that hash as a detached PKCS#7/CMS SignedData, then patch the bytes back in without
 * shifting any offsets. Only adds the invisible /Sig field; any visual stamp is separate.
 */
export async function signPdfWithCertificate(
  pdfBytes: Uint8Array,
  bundle: CertBundle,
  opts: SignOptions
): Promise<SignResult> {
  const doc = await PDFDocument.load(pdfBytes);
  const context = doc.context;
  const page = doc.getPage(0);
  const signingTime = new Date();

  const reservedBytes = opts.timestamp ? RESERVED_SIGNATURE_BYTES_WITH_TIMESTAMP : RESERVED_SIGNATURE_BYTES;
  const contentsHexLen = CONTENTS_PLACEHOLDER_LEN(reservedBytes);
  const contentsPlaceholder = "0".repeat(contentsHexLen);

  const form = doc.getForm();
  const acroFormDict = form.acroForm.dict;
  acroFormDict.set(PDFName.of("SigFlags"), PDFNumber.of(3));

  const byteRangeArray = context.obj([
    0,
    BYTE_RANGE_PLACEHOLDER_NUM,
    BYTE_RANGE_PLACEHOLDER_NUM,
    BYTE_RANGE_PLACEHOLDER_NUM,
  ]);

  const sigValueDict = PDFDict.withContext(context);
  sigValueDict.set(PDFName.of("Type"), PDFName.of("Sig"));
  sigValueDict.set(PDFName.of("Filter"), PDFName.of("Adobe.PPKLite"));
  sigValueDict.set(PDFName.of("SubFilter"), PDFName.of("adbe.pkcs7.detached"));
  sigValueDict.set(PDFName.of("ByteRange"), byteRangeArray);
  sigValueDict.set(PDFName.of("Contents"), PDFHexString.of(contentsPlaceholder));
  sigValueDict.set(PDFName.of("M"), PDFString.fromDate(signingTime));
  sigValueDict.set(PDFName.of("Name"), PDFString.of(opts.signerName));
  if (opts.reason) sigValueDict.set(PDFName.of("Reason"), PDFString.of(opts.reason));
  if (opts.location) sigValueDict.set(PDFName.of("Location"), PDFString.of(opts.location));
  if (opts.contactInfo) sigValueDict.set(PDFName.of("ContactInfo"), PDFString.of(opts.contactInfo));
  const sigValueRef = context.register(sigValueDict);

  const widgetDict = PDFDict.withContext(context);
  widgetDict.set(PDFName.of("FT"), PDFName.of("Sig"));
  widgetDict.set(PDFName.of("Type"), PDFName.of("Annot"));
  widgetDict.set(PDFName.of("Subtype"), PDFName.of("Widget"));
  widgetDict.set(PDFName.of("Rect"), context.obj([0, 0, 0, 0]));
  widgetDict.set(PDFName.of("F"), PDFNumber.of(4));
  widgetDict.set(PDFName.of("T"), PDFString.of(`Signature-${Date.now()}`));
  widgetDict.set(PDFName.of("V"), sigValueRef);
  widgetDict.set(PDFName.of("P"), page.ref);
  const widgetRef = context.register(widgetDict);

  form.acroForm.addField(widgetRef);

  const existingAnnots = page.node.get(PDFName.of("Annots"));
  const annotsArray = existingAnnots
    ? context.lookup(existingAnnots, PDFArray)
    : (() => {
        const arr = context.obj([]);
        page.node.set(PDFName.of("Annots"), arr);
        return arr;
      })();
  annotsArray.push(widgetRef);

  const saved = await doc.save({ useObjectStreams: false });
  const latin1 = latin1Decode(saved);

  const byteRangeRegex = new RegExp(
    `/ByteRange\\s*\\[\\s*0\\s+${BYTE_RANGE_PLACEHOLDER_NUM}\\s+${BYTE_RANGE_PLACEHOLDER_NUM}\\s+${BYTE_RANGE_PLACEHOLDER_NUM}\\s*\\]`
  );
  const byteRangeMatch = byteRangeRegex.exec(latin1);
  if (!byteRangeMatch) throw new Error("Failed to locate the /ByteRange placeholder after saving.");
  const byteRangeStart = byteRangeMatch.index;
  const byteRangeMatchLen = byteRangeMatch[0].length;

  const contentsMarker = `/Contents <${contentsPlaceholder}>`;
  const contentsMarkerIdx = latin1.indexOf(contentsMarker);
  if (contentsMarkerIdx === -1) throw new Error("Failed to locate the /Contents placeholder after saving.");
  const contentsHexStart = contentsMarkerIdx + "/Contents <".length;
  const contentsHexEnd = contentsHexStart + contentsHexLen;

  const totalLen = saved.length;
  const range1Length = contentsHexStart;
  const range2Start = contentsHexEnd;
  const range2Length = totalLen - contentsHexEnd;

  let byteRangeReplacement = `/ByteRange [0 ${range1Length} ${range2Start} ${range2Length}]`;
  if (byteRangeReplacement.length > byteRangeMatchLen) {
    throw new Error("Signed file is too large for the reserved /ByteRange placeholder width.");
  }
  byteRangeReplacement = byteRangeReplacement.padEnd(byteRangeMatchLen, " ");
  writeAsciiAt(saved, byteRangeStart, byteRangeReplacement);

  const signingInput = new Uint8Array(range1Length + range2Length);
  signingInput.set(saved.subarray(0, range1Length), 0);
  signingInput.set(saved.subarray(range2Start, range2Start + range2Length), range1Length);

  const built = buildDetachedPkcs7(signingInput, bundle, signingTime);
  let der = built.der;
  let timestamped = false;
  if (opts.timestamp) {
    const sigHash = await sha256(built.signatureBytes);
    const tokenDer = await requestTimestamp(sigHash, opts.tsaUrl ?? DEFAULT_TSA_URL, opts.tsaTransport);
    der = embedTimestampToken(der, tokenDer);
    timestamped = true;
  }

  const signatureHex = forge.util.bytesToHex(forge.util.binary.raw.encode(der));
  if (signatureHex.length > contentsHexLen) {
    throw new Error(
      opts.timestamp
        ? "Timestamped signature is larger than the reserved /Contents placeholder — the TSA's certificate chain may be unusually large."
        : "Signature is larger than the reserved /Contents placeholder — increase RESERVED_SIGNATURE_BYTES."
    );
  }
  writeAsciiAt(saved, contentsHexStart, signatureHex.padEnd(contentsHexLen, "0"));

  return { bytes: saved, signingTime, timestamped };
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

function buildDetachedPkcs7(
  signingInput: Uint8Array,
  bundle: CertBundle,
  signingTime: Date
): { der: Uint8Array; signatureBytes: Uint8Array } {
  const cert = forge.pki.certificateFromPem(bundle.certPem);
  const privateKey = forge.pki.privateKeyFromPem(bundle.privateKeyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(bytesToForgeBinary(signingInput));
  p7.addCertificate(cert);
  for (const chainPem of bundle.certChainPem) {
    p7.addCertificate(forge.pki.certificateFromPem(chainPem));
  }
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: signingTime.toUTCString() as unknown as string },
    ],
  });
  p7.sign({ detached: true });

  // The raw RSA signature bytes (pre-ASN.1) are what an RFC3161 timestamp covers. `.signers`
  // is populated by `addSigner`/`sign` but isn't declared on @types/node-forge.
  const signerWithSignature = (p7 as unknown as { signers: { signature: string }[] }).signers[0];
  const signatureBytes = new Uint8Array(forge.util.binary.raw.decode(signerWithSignature.signature));
  const der = new Uint8Array(forge.util.binary.raw.decode(forge.asn1.toDer(p7.toAsn1()).getBytes()));
  return { der, signatureBytes };
}

export type SignatureVerification = {
  fieldName: string;
  signerName?: string;
  signingTime?: string;
  reason?: string;
  location?: string;
  /** The recomputed content digest matches the messageDigest the signer originally signed. */
  integrityValid: boolean;
  /** The RSA signature over the signed attributes verifies against the embedded certificate's public key. */
  signatureMathValid: boolean;
  /** Bytes exist in the file after this signature's ByteRange — i.e. the file was changed since signing. */
  documentModifiedAfterSigning: boolean;
  certificateSubject: string;
  certificateIssuer: string;
  isSelfSigned: boolean;
  certificateValidNow: boolean;
  /** RFC3161 signature timestamp, if one is embedded. */
  timestampGenTime?: string;
  timestampAuthority?: string;
  error?: string;
};

const DIGEST_OID_TO_MD: Record<string, () => forge.md.MessageDigest> = {
  [forge.pki.oids.sha256]: () => forge.md.sha256.create(),
  [forge.pki.oids.sha1]: () => forge.md.sha1.create(),
  [forge.pki.oids.sha384]: () => forge.md.sha384.create(),
  [forge.pki.oids.sha512]: () => forge.md.sha512.create(),
};

/** Finds the Attribute (SEQUENCE { type OID, values SET OF ANY }) matching `oid` and
 * returns the DER bytes of its first value. */
function findAttributeValueBytes(attributes: ForgeAsn1[], oid: string): string | null {
  for (const attr of attributes) {
    const oidNode = attr.value[0] as ForgeAsn1 | undefined;
    const valuesSet = attr.value[1] as ForgeAsn1 | undefined;
    if (!oidNode || !valuesSet) continue;
    if (forge.asn1.derToOid(oidNode.value as string) === oid) {
      const firstValue = valuesSet.value[0] as ForgeAsn1 | undefined;
      return firstValue ? (firstValue.value as string) : null;
    }
  }
  return null;
}

function verifyOneSignature(fileBytes: Uint8Array, sigDict: PDFDict, context: PDFDocument["context"]): SignatureVerification {
  const base: Partial<SignatureVerification> = {};
  try {
    const nameObj = sigDict.get(PDFName.of("Name"));
    const reasonObj = sigDict.get(PDFName.of("Reason"));
    const locationObj = sigDict.get(PDFName.of("Location"));
    const mObj = sigDict.get(PDFName.of("M"));
    base.signerName = nameObj instanceof PDFString ? nameObj.decodeText() : undefined;
    base.reason = reasonObj instanceof PDFString ? reasonObj.decodeText() : undefined;
    base.location = locationObj instanceof PDFString ? locationObj.decodeText() : undefined;
    base.signingTime = mObj instanceof PDFString ? mObj.decodeText() : undefined;

    const byteRangeArr = context.lookup(sigDict.get(PDFName.of("ByteRange")), PDFArray);
    const contentsObj = sigDict.get(PDFName.of("Contents"));
    if (!byteRangeArr || !(contentsObj instanceof PDFHexString)) {
      throw new Error("Missing /ByteRange or /Contents.");
    }

    const nums = [0, 1, 2, 3].map((i) => context.lookup(byteRangeArr.get(i), PDFNumber).asNumber());
    const [r0, r1, r2, r3] = nums;

    const signedBytes = new Uint8Array(r1 + r3);
    signedBytes.set(fileBytes.subarray(r0, r0 + r1), 0);
    signedBytes.set(fileBytes.subarray(r2, r2 + r3), r1);
    const documentModifiedAfterSigning = r2 + r3 < fileBytes.length;

    const derBytes = contentsObj.asBytes();
    // /Contents is right-padded with zero bytes past the real DER length, so parseAllBytes:false
    // stops at the first complete ASN.1 structure. forge accepts an options object here despite
    // @types/node-forge typing the 2nd arg as `strict?: boolean`.
    const fromDerLoose = forge.asn1.fromDer as unknown as (bytes: string, options: { parseAllBytes: boolean }) => ForgeAsn1;
    const asn1obj = fromDerLoose(bytesToForgeBinary(derBytes), { parseAllBytes: false });
    const p7 = forge.pkcs7.messageFromAsn1(asn1obj) as forge.pkcs7.PkcsSignedData & {
      rawCapture: {
        digestAlgorithm: string;
        authenticatedAttributes: ForgeAsn1[];
        signature: string;
      };
    };

    const cert = p7.certificates[0];
    if (!cert) throw new Error("No certificate embedded in signature.");

    const digestOid = forge.asn1.derToOid(p7.rawCapture.digestAlgorithm);
    const mdFactory = DIGEST_OID_TO_MD[digestOid];
    if (!mdFactory) throw new Error(`Unsupported digest algorithm ${digestOid}.`);

    const computedContentDigest = mdFactory().update(bytesToForgeBinary(signedBytes)).digest().getBytes();
    const attrs = p7.rawCapture.authenticatedAttributes;
    const claimedDigest = findAttributeValueBytes(attrs, forge.pki.oids.messageDigest);
    const integrityValid = claimedDigest !== null && claimedDigest === computedContentDigest;

    const attrsSet = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
    const attrsDigest = mdFactory().update(forge.asn1.toDer(attrsSet).getBytes()).digest().getBytes();
    let signatureMathValid = false;
    try {
      const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
      signatureMathValid = publicKey.verify(attrsDigest, p7.rawCapture.signature);
    } catch {
      signatureMathValid = false;
    }

    const now = new Date();
    const timestamp = parseEmbeddedTimestamp(asn1obj);
    return {
      fieldName: base.fieldName ?? "",
      signerName: base.signerName,
      signingTime: base.signingTime,
      reason: base.reason,
      location: base.location,
      integrityValid,
      signatureMathValid,
      documentModifiedAfterSigning,
      certificateSubject: String(cert.subject.getField("CN")?.value ?? "Unknown"),
      certificateIssuer: String(cert.issuer.getField("CN")?.value ?? "Unknown"),
      isSelfSigned: cert.isIssuer(cert),
      certificateValidNow: now >= cert.validity.notBefore && now <= cert.validity.notAfter,
      timestampGenTime: timestamp.genTime?.toISOString(),
      timestampAuthority: timestamp.tsaName ?? undefined,
    };
  } catch (err) {
    return {
      fieldName: base.fieldName ?? "",
      signerName: base.signerName,
      signingTime: base.signingTime,
      reason: base.reason,
      location: base.location,
      integrityValid: false,
      signatureMathValid: false,
      documentModifiedAfterSigning: false,
      certificateSubject: "Unknown",
      certificateIssuer: "Unknown",
      isSelfSigned: false,
      certificateValidNow: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Finds every /FT /Sig AcroForm field with a signature value and verifies it. */
export async function verifyPdfSignatures(bytes: Uint8Array): Promise<SignatureVerification[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const context = doc.context;
  const results: SignatureVerification[] = [];

  const acroFormObj = doc.catalog.get(PDFName.of("AcroForm"));
  const acroForm = acroFormObj ? context.lookup(acroFormObj, PDFDict) : undefined;
  if (!acroForm) return results;

  const fields = context.lookup(acroForm.get(PDFName.of("Fields")), PDFArray);
  if (!fields) return results;

  for (let i = 0; i < fields.size(); i++) {
    const fieldDict = context.lookup(fields.get(i), PDFDict);
    if (!fieldDict) continue;
    const ft = fieldDict.get(PDFName.of("FT"));
    if (!ft || ft.toString() !== "/Sig") continue;

    const vObj = fieldDict.get(PDFName.of("V"));
    const sigDict = vObj ? context.lookup(vObj, PDFDict) : undefined;
    if (!sigDict) continue;

    const tObj = fieldDict.get(PDFName.of("T"));
    const fieldName = tObj instanceof PDFString ? tObj.decodeText() : `Field ${i}`;

    const result = verifyOneSignature(bytes, sigDict, context);
    result.fieldName = fieldName;
    results.push(result);
  }

  return results;
}
