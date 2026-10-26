import forge from "node-forge";

const asn1 = forge.asn1;

// RFC3161 §2.4.1: TimeStampReq ::= SEQUENCE {
//   version          INTEGER { v1(1) },
//   messageImprint   MessageImprint,
//   reqPolicy        TSAPolicyId OPTIONAL,
//   nonce            INTEGER OPTIONAL,
//   certReq          BOOLEAN DEFAULT FALSE,
//   extensions       [0] IMPLICIT Extensions OPTIONAL }
// MessageImprint ::= SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }
function buildTimeStampRequest(hash: Uint8Array): Uint8Array {
  const nonceBytes = forge.random.getBytesSync(8);
  const req = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
      ]),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, forge.util.binary.raw.encode(hash)),
    ]),
    // nonce (helps a client match a response to its own request / detect replay)
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, nonceBytes),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BOOLEAN, false, String.fromCharCode(0xff)),
  ]);
  return new Uint8Array(forge.util.binary.raw.decode(asn1.toDer(req).getBytes()));
}

// TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken TimeStampToken OPTIONAL }
// PKIStatusInfo ::= SEQUENCE { status INTEGER, ... }
// TimeStampToken ::= ContentInfo (a full CMS SignedData wrapping a TSTInfo)
function parseTimeStampResponse(der: Uint8Array): { status: number; tokenDer: Uint8Array | null } {
  const obj = asn1.fromDer(forge.util.binary.raw.encode(der));
  const statusInfo = obj.value[0];
  const statusInt = (statusInfo as forge.asn1.Asn1).value[0] as forge.asn1.Asn1;
  const status = forge.asn1.derToInteger(statusInt.value as string);
  const tokenNode = obj.value[1] as forge.asn1.Asn1 | undefined;
  const tokenDer = tokenNode ? new Uint8Array(forge.util.binary.raw.decode(asn1.toDer(tokenNode).getBytes())) : null;
  return { status, tokenDer };
}

export type TsaTransport = (url: string, body: Uint8Array) => Promise<Uint8Array>;

/** Default transport: a plain `fetch`. */
async function fetchTransport(url: string, body: Uint8Array): Promise<Uint8Array> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/timestamp-query" },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`TSA responded with HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Requests an RFC3161 timestamp token for `hash` (must already be a SHA-256 digest) from `tsaUrl`. */
export async function requestTimestamp(
  hash: Uint8Array,
  tsaUrl: string,
  transport: TsaTransport = fetchTransport
): Promise<Uint8Array> {
  const reqDer = buildTimeStampRequest(hash);
  let respDer: Uint8Array;
  try {
    respDer = await transport(tsaUrl, reqDer);
  } catch (err) {
    throw new Error(
      `Couldn't reach the timestamp authority (${tsaUrl}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const { status, tokenDer } = parseTimeStampResponse(respDer);
  // PKIStatus: 0 = granted, 1 = grantedWithMods — both mean a usable token was returned.
  if (status !== 0 && status !== 1) throw new Error(`Timestamp authority rejected the request (status ${status}).`);
  if (!tokenDer) throw new Error("Timestamp authority returned no token.");
  return tokenDer;
}

export const DEFAULT_TSA_URL = "https://freetsa.org/tsr";

export type EmbeddedTimestampInfo = { genTime: Date | null; tsaName: string | null };

/** Reverse of `embedTimestampToken`'s tree walk. */
export function parseEmbeddedTimestamp(contentInfoAsn1: forge.asn1.Asn1): EmbeddedTimestampInfo {
  const empty: EmbeddedTimestampInfo = { genTime: null, tsaName: null };
  try {
    const signerInfo = findFirstSignerInfo(contentInfoAsn1);
    const last = signerInfo.value[signerInfo.value.length - 1] as forge.asn1.Asn1;
    if (!isContextTag(last, 1)) return empty;

    for (const attr of last.value as forge.asn1.Asn1[]) {
      const oidNode = attr.value[0] as forge.asn1.Asn1;
      if (asn1.derToOid(oidNode.value as string) !== TIMESTAMP_TOKEN_ATTR_OID) continue;
      const valuesSet = attr.value[1] as forge.asn1.Asn1;
      const tokenContentInfo = valuesSet.value[0] as forge.asn1.Asn1;

      const tokenSignedData = (tokenContentInfo.value[1] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1;
      const encapContentInfo = tokenSignedData.value[2] as forge.asn1.Asn1;
      const eContentExplicit = encapContentInfo.value[1] as forge.asn1.Asn1 | undefined;
      if (!eContentExplicit) return empty;
      const eContentOctets = eContentExplicit.value[0] as forge.asn1.Asn1;
      const tstInfo = asn1.fromDer(eContentOctets.value as string);

      // TSTInfo ::= SEQUENCE { version, policy, messageImprint, serialNumber, genTime, ... }
      const genTimeNode = tstInfo.value[4] as forge.asn1.Asn1 | undefined;
      const genTime = genTimeNode ? asn1.generalizedTimeToDate(genTimeNode.value as string) : null;

      let tsaName: string | null = null;
      try {
        const certAsn1 = (tokenSignedData.value[3] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1;
        const cert = forge.pki.certificateFromAsn1(certAsn1);
        tsaName = String(cert.subject.getField("CN")?.value ?? cert.subject.attributes[0]?.value ?? "");
      } catch {
      }

      return { genTime, tsaName: tsaName || null };
    }
  } catch {
    return empty;
  }
  return empty;
}

const TIMESTAMP_TOKEN_ATTR_OID = "1.2.840.113549.1.9.16.2.14"; // id-aa-signatureTimeStampToken

function isContextTag(node: forge.asn1.Asn1, tag: number): boolean {
  return node.tagClass === asn1.Class.CONTEXT_SPECIFIC && node.type === tag;
}

/** Navigates ContentInfo -> [0] SignedData -> SEQUENCE -> SignerInfos SET -> first
 * SignerInfo, throwing if any step doesn't match the expected shape. */
function findFirstSignerInfo(contentInfo: forge.asn1.Asn1): forge.asn1.Asn1 {
  // ContentInfo ::= SEQUENCE { contentType OID, content [0] EXPLICIT ANY }
  const explicitContent = contentInfo.value[1] as forge.asn1.Asn1;
  if (!isContextTag(explicitContent, 0)) throw new Error("Unexpected PKCS#7 structure (no [0] SignedData).");
  const signedData = explicitContent.value[0] as forge.asn1.Asn1; // SignedData SEQUENCE

  const signerInfosSet = signedData.value[signedData.value.length - 1] as forge.asn1.Asn1;
  if (signerInfosSet.type !== asn1.Type.SET) throw new Error("Unexpected PKCS#7 structure (no SignerInfos SET).");
  return signerInfosSet.value[0] as forge.asn1.Asn1; // first (only) SignerInfo SEQUENCE
}

/**
 * Splices an RFC3161 TimeStampToken into a detached CMS SignedData's SignerInfo as an
 * unsigned attribute (id-aa-signatureTimeStampToken). Rebuilds the `[1] IMPLICIT` node
 * directly because node-forge's unauthenticatedAttributes writer pushes onto a `.values`
 * typo and leaves the SET empty. Throws if the result doesn't parse back correctly.
 */
export function embedTimestampToken(contentInfoDer: Uint8Array, timeStampTokenDer: Uint8Array): Uint8Array {
  const contentInfo = asn1.fromDer(forge.util.binary.raw.encode(contentInfoDer));
  const signerInfo = findFirstSignerInfo(contentInfo);

  const tsToken = asn1.fromDer(forge.util.binary.raw.encode(timeStampTokenDer));
  const attribute = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(TIMESTAMP_TOKEN_ATTR_OID).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [tsToken]),
  ]);
  const unsignedAttrs = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [attribute]);
  (signerInfo.value as forge.asn1.Asn1[]).push(unsignedAttrs);

  const resultDer = new Uint8Array(forge.util.binary.raw.decode(asn1.toDer(contentInfo).getBytes()));

  const reparsed = asn1.fromDer(forge.util.binary.raw.encode(resultDer));
  const reSignerInfo = findFirstSignerInfo(reparsed);
  const reUnsigned = reSignerInfo.value[reSignerInfo.value.length - 1] as forge.asn1.Asn1;
  if (!isContextTag(reUnsigned, 1) || reUnsigned.value.length === 0) {
    throw new Error("Timestamp embedding failed a structural round-trip check — aborting.");
  }

  return resultDer;
}
