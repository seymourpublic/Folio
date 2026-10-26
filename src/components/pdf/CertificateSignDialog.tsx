"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { signPdfWithCertificate, type SignatureVerification, type StoredCertMeta } from "@folio/engine/signing";
import { listCertificates, loadCertificateBundle } from "@/lib/pdf/certificates";
import { electronTsaTransport } from "@/lib/electron-bridge";

type CertificateSignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  exportCurrentBytes: () => Promise<Uint8Array>;
  onSigned: (bytes: Uint8Array) => Promise<void> | void;
  existingSignatures: SignatureVerification[];
};

export function CertificateSignDialog({
  open,
  onOpenChange,
  fileName,
  exportCurrentBytes,
  onSigned,
  existingSignatures,
}: CertificateSignDialogProps) {
  const [certs, setCerts] = useState<StoredCertMeta[]>([]);
  const [certId, setCertId] = useState<string>("");
  const [passphrase, setPassphrase] = useState("");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("");
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listCertificates().then((list) => {
      setCerts(list);
      if (list[0]) setCertId(list[0].id);
    });
  }, [open]);

  const selectedCert = certs.find((c) => c.id === certId);

  async function handleSign() {
    setError(null);
    if (!selectedCert || !passphrase.trim()) {
      setError("Choose a certificate and enter its storage passphrase.");
      return;
    }
    setBusy(true);
    try {
      const bundle = await loadCertificateBundle(selectedCert.id, passphrase);
      const bytes = await exportCurrentBytes();
      const { bytes: signed } = await signPdfWithCertificate(bytes, bundle, {
        signerName: selectedCert.subjectName,
        reason: reason.trim() || undefined,
        location: location.trim() || undefined,
        timestamp: addTimestamp,
        tsaTransport: electronTsaTransport(),
      });
      await onSigned(signed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign with certificate</DialogTitle>
          <DialogDescription>
            Adds a real, cryptographically verifiable signature to &quot;{fileName}&quot; using a
            certificate stored in this browser.
          </DialogDescription>
        </DialogHeader>

        {existingSignatures.length > 0 && (
          <div className="space-y-1.5 rounded border p-2">
            <Label className="text-xs uppercase">Existing signatures in this document</Label>
            {existingSignatures.map((s, i) => {
              const Icon = s.error ? ShieldX : s.integrityValid && s.signatureMathValid ? ShieldCheck : ShieldAlert;
              const color = s.error
                ? "text-destructive"
                : s.integrityValid && s.signatureMathValid
                  ? "text-green-600"
                  : "text-amber-600";
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div>
                    <p className="font-medium">{s.signerName ?? s.certificateSubject}</p>
                    <p className="text-muted-foreground">
                      {s.error
                        ? s.error
                        : !s.integrityValid
                          ? "Document modified since this signature was applied"
                          : !s.signatureMathValid
                            ? "Signature does not match the certificate"
                            : s.isSelfSigned
                              ? "Valid — self-signed certificate (not chain-trusted)"
                              : "Valid"}
                      {s.documentModifiedAfterSigning && " · further changes made after signing"}
                    </p>
                    {s.timestampGenTime && (
                      <p className="text-muted-foreground">
                        Timestamped {new Date(s.timestampGenTime).toLocaleString()}
                        {s.timestampAuthority && ` by ${s.timestampAuthority}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {certs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No certificates stored yet. Open Security center → Certificates to generate or import one.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Certificate</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
              >
                {certs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.subjectName})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Certificate passphrase</Label>
              <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I approve this document" />
            </div>
            <div className="space-y-1.5">
              <Label>Location (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={addTimestamp}
                onChange={(e) => setAddTimestamp(e.target.checked)}
              />
              <span>
                Add a trusted timestamp (RFC3161) — proves when the signature was created using
                an independent time authority, not just this computer&apos;s clock. Sends only a
                hash, never the document, to freetsa.org. Requires network access.
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-destructive text-xs">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || certs.length === 0} onClick={handleSign}>
            {busy ? "Signing…" : "Sign & download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
