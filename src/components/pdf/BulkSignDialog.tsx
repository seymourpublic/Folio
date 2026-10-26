"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, CheckCircle2, Circle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { signPdfWithCertificate, type StoredCertMeta } from "@folio/engine/signing";
import { listCertificates, loadCertificateBundle } from "@/lib/pdf/certificates";
import JSZip from "jszip";

type BulkSignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  exportCurrentBytes: () => Promise<Uint8Array>;
};

type Signer = { id: string; name: string; signed: boolean };

function downloadBytesLocal(bytes: Uint8Array, name: string, type = "application/pdf") {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkSignDialog({ open, onOpenChange, fileName, exportCurrentBytes }: BulkSignDialogProps) {
  const [certs, setCerts] = useState<StoredCertMeta[]>([]);
  const [certId, setCertId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bulk (many files, one cert)
  const [files, setFiles] = useState<File[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // Multi-party (one file, sequential signers)
  const [signers, setSigners] = useState<Signer[]>([]);
  const [newSignerName, setNewSignerName] = useState("");
  const [partyBusy, setPartyBusy] = useState(false);
  const [partyBytes, setPartyBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!open) return;
    listCertificates().then((list) => {
      setCerts(list);
      if (list[0]) setCertId(list[0].id);
      setFiles([]);
      setSigners([]);
      setPartyBytes(null);
      setError(null);
    });
  }, [open]);

  const selectedCert = certs.find((c) => c.id === certId);

  async function handleBulkSign() {
    setError(null);
    if (!selectedCert || !passphrase.trim() || files.length === 0) {
      setError("Choose a certificate, its passphrase, and at least one file.");
      return;
    }
    setBulkBusy(true);
    setBulkProgress(0);
    try {
      const bundle = await loadCertificateBundle(selectedCert.id, passphrase);
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { bytes: signed } = await signPdfWithCertificate(bytes, bundle, { signerName: selectedCert.subjectName });
        zip.file(file.name.replace(/\.pdf$/i, "") + "-signed.pdf", signed);
        setBulkProgress((i + 1) / files.length);
      }
      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      downloadBytesLocal(zipBytes, "bulk-signed.zip", "application/zip");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handlePartySign(signer: Signer) {
    setError(null);
    if (!selectedCert || !passphrase.trim()) {
      setError("Choose a certificate and enter its passphrase to sign as this party.");
      return;
    }
    setPartyBusy(true);
    try {
      const bundle = await loadCertificateBundle(selectedCert.id, passphrase);
      const currentBytes = partyBytes ?? (await exportCurrentBytes());
      const { bytes: signed } = await signPdfWithCertificate(currentBytes, bundle, {
        signerName: signer.name,
        reason: `Signed by ${signer.name} (multi-party workflow)`,
      });
      setPartyBytes(signed);
      setSigners((prev) => prev.map((s) => (s.id === signer.id ? { ...s, signed: true } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPartyBusy(false);
    }
  }

  const allSigned = signers.length > 0 && signers.every((s) => s.signed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk &amp; multi-party signing</DialogTitle>
          <DialogDescription>
            Multi-party signing happens locally, in order — there&apos;s no email routing here, so pass the
            file to the next signer yourself (or have them use this same browser/profile in turn).
          </DialogDescription>
        </DialogHeader>

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
          <Input type="password" placeholder="Certificate passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        </div>

        <Tabs defaultValue="bulk">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bulk">Multiple files</TabsTrigger>
            <TabsTrigger value="party">Multi-party (this file)</TabsTrigger>
          </TabsList>

          <TabsContent value="bulk" className="space-y-3">
            <Input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && <p className="text-muted-foreground text-xs">{files.length} file(s) selected</p>}
            <Button size="sm" disabled={bulkBusy || files.length === 0} onClick={handleBulkSign}>
              {bulkBusy ? `Signing… ${Math.round(bulkProgress * 100)}%` : "Sign all & download .zip"}
            </Button>
          </TabsContent>

          <TabsContent value="party" className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Signer name"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSignerName.trim()) {
                    setSigners((prev) => [...prev, { id: crypto.randomUUID(), name: newSignerName.trim(), signed: false }]);
                    setNewSignerName("");
                  }
                }}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  if (!newSignerName.trim()) return;
                  setSigners((prev) => [...prev, { id: crypto.randomUUID(), name: newSignerName.trim(), signed: false }]);
                  setNewSignerName("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              {signers.map((s, i) => {
                const isNext = !s.signed && signers.slice(0, i).every((prev) => prev.signed);
                return (
                  <div key={s.id} className={cn("flex items-center gap-2 rounded border p-2 text-sm", s.signed && "bg-muted/50")}>
                    {s.signed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1">{s.name}</span>
                    {!s.signed && isNext && (
                      <Button size="sm" disabled={partyBusy} onClick={() => handlePartySign(s)}>
                        Sign now
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setSigners((prev) => prev.filter((x) => x.id !== s.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {partyBytes && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadBytesLocal(partyBytes, fileName.replace(/\.pdf$/i, "") + "-multisigned.pdf")}
              >
                Download {allSigned ? "fully signed" : "partially signed"} copy
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {error && <p className="text-destructive text-xs">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
