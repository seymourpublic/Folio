import forge from "node-forge";

export type CertBundle = { certPem: string; certChainPem: string[]; privateKeyPem: string };

export type StoredCertMeta = {
  id: string;
  label: string;
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  isSelfSigned: boolean;
  createdAt: number;
};

function bytesToForgeBinary(bytes: Uint8Array): string {
  return forge.util.binary.raw.encode(bytes);
}

export function generateSelfSignedCertificate(opts: {
  commonName: string;
  email?: string;
  organization?: string;
  validityDays: number;
}): Promise<{ certPem: string; privateKeyPem: string }> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keys) => {
      if (err || !keys) {
        reject(err ?? new Error("Key generation failed"));
        return;
      }
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(8));
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + opts.validityDays);

      const attrs: forge.pki.CertificateField[] = [
        { name: "commonName", value: opts.commonName },
        ...(opts.organization ? [{ name: "organizationName", value: opts.organization }] : []),
        { shortName: "OU", value: "Self-signed (Acrobat Clone)" },
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.setExtensions([
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
        { name: "extKeyUsage", emailProtection: true },
        ...(opts.email ? [{ name: "subjectAltName", altNames: [{ type: 1, value: opts.email }] }] : []),
      ]);
      cert.sign(keys.privateKey, forge.md.sha256.create());

      resolve({ certPem: forge.pki.certificateToPem(cert), privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey) });
    });
  });
}

export function importPkcs12(bytes: Uint8Array, password: string): CertBundle {
  let asn1obj: forge.asn1.Asn1;
  try {
    asn1obj = forge.asn1.fromDer(forge.util.createBuffer(bytesToForgeBinary(bytes)));
  } catch {
    throw new Error("This file doesn't look like a valid .p12/.pfx certificate file.");
  }

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1obj, password);
  } catch {
    throw new Error("Couldn't open this certificate file — the password may be wrong.");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];

  const keyBag = keyBags[0];
  if (!keyBag?.key || certBags.length === 0 || !certBags[0].cert) {
    throw new Error("Couldn't find a certificate and private key inside this file.");
  }

  return {
    certPem: forge.pki.certificateToPem(certBags[0].cert),
    certChainPem: certBags.slice(1).flatMap((b) => (b.cert ? [forge.pki.certificateToPem(b.cert)] : [])),
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key as forge.pki.PrivateKey),
  };
}

/** Derives display metadata (subject/issuer/validity/serial) from a certificate PEM. */
export function certInfo(certPem: string): {
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  isSelfSigned: boolean;
} {
  const cert = forge.pki.certificateFromPem(certPem);
  const subjectName = cert.subject.getField("CN")?.value ?? cert.subject.attributes.map((a) => a.value).join(", ");
  const issuerName = cert.issuer.getField("CN")?.value ?? cert.issuer.attributes.map((a) => a.value).join(", ");
  return {
    subjectName: String(subjectName),
    issuerName: String(issuerName),
    serialNumber: cert.serialNumber,
    notBefore: cert.validity.notBefore.toISOString(),
    notAfter: cert.validity.notAfter.toISOString(),
    isSelfSigned: cert.isIssuer(cert),
  };
}
