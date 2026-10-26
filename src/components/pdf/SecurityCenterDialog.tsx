"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Download, RotateCcw, Save, ShieldCheck, ShieldAlert, Copy, Check, Code2, Palette, AlertTriangle, CheckCircle2 } from "lucide-react";
import { generateSelfSignedCertificate, importPkcs12, newSigningStep, type SignatureVerification, type SigningPlanStep, type StoredCertMeta } from "@folio/engine/signing";
import { deleteCertificate, listCertificates, saveCertificate } from "@/lib/pdf/certificates";
import { getSigningPlan, setSigningPlan } from "@/lib/pdf/signing-plan-store";
import { deleteVersion, listVersions, saveVersionSnapshot, type VersionMeta } from "@/lib/pdf/version-history";
import { getAuditTrail } from "@/lib/pdf/audit-log";
import { inspectJavaScript, scanColorSpaces, type JsActionReport, type ColorSpaceReport, type AuditEvent, type PdfDocumentProxy } from "@folio/engine";
import { cn } from "@/lib/utils";

type SecurityCenterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  fileName: string;
  doc: PdfDocumentProxy | undefined;
  /** Original, as-uploaded bytes (not the pdf-lib re-export from `exportCurrentBytes`). */
  sourceBytes: ArrayBuffer | Uint8Array | undefined;
  existingSignatures: SignatureVerification[];
  exportCurrentBytes: () => Promise<Uint8Array>;
  onRestoreVersion: (bytes: Uint8Array, fileName: string) => void;
  onScrubAndDownload: () => Promise<void>;
  onSecureShare: (password: string) => Promise<void>;
};

function downloadLocalBytes(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function generateStrongPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 20);
}

export function SecurityCenterDialog({
  open,
  onOpenChange,
  documentId,
  fileName,
  doc,
  sourceBytes,
  existingSignatures,
  exportCurrentBytes,
  onRestoreVersion,
  onScrubAndDownload,
  onSecureShare,
}: SecurityCenterDialogProps) {
  const [tab, setTab] = useState("certificates");

  // Signing plan (multi-party/sequential checklist) — loaded once per dialog open.
  const [signingPlan, setSigningPlanState] = useState<SigningPlanStep[]>([]);
  const [newSignerName, setNewSignerName] = useState("");
  const [newSignerRole, setNewSignerRole] = useState("");

  useEffect(() => {
    if (!open) return;
    getSigningPlan(documentId).then(setSigningPlanState);
  }, [open, documentId]);

  async function addSigningStep() {
    if (!newSignerName.trim()) return;
    const next = [...signingPlan, newSigningStep(newSignerName.trim(), newSignerRole.trim() || undefined)];
    setSigningPlanState(next);
    await setSigningPlan(documentId, next);
    setNewSignerName("");
    setNewSignerRole("");
  }

  async function removeSigningStep(id: string) {
    const next = signingPlan.filter((s) => s.id !== id);
    setSigningPlanState(next);
    await setSigningPlan(documentId, next);
  }

  function normalizeForMatch(name: string): string {
    return name.trim().toLowerCase();
  }

  const signedNames = new Set(
    existingSignatures
      .filter((s) => s.integrityValid && s.signatureMathValid)
      .map((s) => normalizeForMatch(s.signerName ?? s.certificateSubject))
  );

  const [jsReport, setJsReport] = useState<JsActionReport | null>(null);
  const [colorReport, setColorReport] = useState<ColorSpaceReport | null>(null);
  const [inspecting, setInspecting] = useState(false);

  useEffect(() => {
    if (tab !== "inspector" || !open || !doc || !sourceBytes || jsReport) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInspecting(true);
    const rawBytes = sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes);
    Promise.all([inspectJavaScript(doc), scanColorSpaces(rawBytes)])
      .then(([js, colors]) => {
        setJsReport(js);
        setColorReport(colors);
      })
      .finally(() => setInspecting(false));
  }, [tab, open, doc, sourceBytes, jsReport]);

  // Re-scan the next time the dialog opens on a different document.
  const [prevDocumentId, setPrevDocumentId] = useState(documentId);
  if (documentId !== prevDocumentId) {
    setPrevDocumentId(documentId);
    if (jsReport) setJsReport(null);
    if (colorReport) setColorReport(null);
  }

  // Certificates
  const [certs, setCerts] = useState<StoredCertMeta[]>([]);
  const [certBusy, setCertBusy] = useState(false);
  const [genCommonName, setGenCommonName] = useState("");
  const [genEmail, setGenEmail] = useState("");
  const [genOrg, setGenOrg] = useState("");
  const [genPassphrase, setGenPassphrase] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importP12Password, setImportP12Password] = useState("");
  const [importLabel, setImportLabel] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [certError, setCertError] = useState<string | null>(null);

  // Versions
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [versionLabel, setVersionLabel] = useState("");
  const [versionBusy, setVersionBusy] = useState(false);

  // Audit log
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Share & scrub
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [scrubBusy, setScrubBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    listCertificates().then(setCerts);
    listVersions(documentId).then(setVersions);
    getAuditTrail(documentId).then(setAuditEvents);
  }, [open, documentId]);

  async function handleGenerate() {
    setCertError(null);
    if (!genCommonName.trim() || !genPassphrase.trim()) {
      setCertError("Name and a storage passphrase are required.");
      return;
    }
    setCertBusy(true);
    try {
      const { certPem, privateKeyPem } = await generateSelfSignedCertificate({
        commonName: genCommonName.trim(),
        email: genEmail.trim() || undefined,
        organization: genOrg.trim() || undefined,
        validityDays: 730,
      });
      await saveCertificate(genCommonName.trim(), { certPem, certChainPem: [], privateKeyPem }, genPassphrase);
      setGenCommonName("");
      setGenEmail("");
      setGenOrg("");
      setGenPassphrase("");
      setCerts(await listCertificates());
    } catch (err) {
      setCertError(err instanceof Error ? err.message : String(err));
    } finally {
      setCertBusy(false);
    }
  }

  async function handleImport() {
    setCertError(null);
    if (!importFile || !importPassphrase.trim()) {
      setCertError("Choose a .p12/.pfx file and a storage passphrase.");
      return;
    }
    setCertBusy(true);
    try {
      const bytes = new Uint8Array(await importFile.arrayBuffer());
      const bundle = importPkcs12(bytes, importP12Password);
      await saveCertificate(importLabel.trim() || importFile.name, bundle, importPassphrase);
      setImportFile(null);
      setImportP12Password("");
      setImportLabel("");
      setImportPassphrase("");
      setCerts(await listCertificates());
    } catch (err) {
      setCertError(err instanceof Error ? err.message : String(err));
    } finally {
      setCertBusy(false);
    }
  }

  async function handleSaveVersion() {
    setVersionBusy(true);
    try {
      const bytes = await exportCurrentBytes();
      await saveVersionSnapshot(documentId, fileName, bytes, versionLabel.trim() || "Untitled version");
      setVersionLabel("");
      setVersions(await listVersions(documentId));
    } finally {
      setVersionBusy(false);
    }
  }

  async function handleShare() {
    setShareBusy(true);
    setCopied(false);
    try {
      const pwd = generateStrongPassword();
      await onSecureShare(pwd);
      setSharePassword(pwd);
    } finally {
      setShareBusy(false);
    }
  }

  async function handleScrub() {
    setScrubBusy(true);
    try {
      await onScrubAndDownload();
    } finally {
      setScrubBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Security center</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="signatures">Signatures</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="share">Share &amp; scrub</TabsTrigger>
            <TabsTrigger value="inspector">Inspector</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="space-y-4">
            <ScrollArea className="h-40 rounded border">
              {certs.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">No certificates stored locally yet.</p>
              ) : (
                <div className="divide-y">
                  {certs.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 text-sm">
                      {c.isSelfSigned ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.label}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.subjectName} · expires {new Date(c.notAfter).toLocaleDateString()}
                          {c.isSelfSigned && " · self-signed (not chain-trusted)"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Delete certificate"
                        onClick={() => deleteCertificate(c.id).then(() => listCertificates().then(setCerts))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {certError && <p className="text-destructive text-xs">{certError}</p>}

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase">Generate self-signed</Label>
                <Input placeholder="Full name" value={genCommonName} onChange={(e) => setGenCommonName(e.target.value)} />
                <Input placeholder="Email (optional)" value={genEmail} onChange={(e) => setGenEmail(e.target.value)} />
                <Input placeholder="Organization (optional)" value={genOrg} onChange={(e) => setGenOrg(e.target.value)} />
                <Input
                  type="password"
                  placeholder="Storage passphrase"
                  value={genPassphrase}
                  onChange={(e) => setGenPassphrase(e.target.value)}
                />
                <Button size="sm" disabled={certBusy} onClick={handleGenerate} className="w-full">
                  Generate &amp; store
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase">Import .p12 / .pfx</Label>
                <Input
                  type="file"
                  accept=".p12,.pfx"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <Input
                  type="password"
                  placeholder="Certificate file password"
                  value={importP12Password}
                  onChange={(e) => setImportP12Password(e.target.value)}
                />
                <Input placeholder="Label" value={importLabel} onChange={(e) => setImportLabel(e.target.value)} />
                <Input
                  type="password"
                  placeholder="Storage passphrase"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                />
                <Button size="sm" disabled={certBusy} onClick={handleImport} className="w-full">
                  Import &amp; store
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Certificates are encrypted at rest in this browser with your storage passphrase and never leave
              your device. Self-signed certificates prove the document hasn&apos;t been altered since signing,
              but won&apos;t show as &quot;trusted&quot; in Acrobat unless you import a certificate from a real CA.
            </p>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-4">
            <div className="space-y-2 rounded border p-3">
              <Label className="text-xs uppercase">Signature history</Label>
              {existingSignatures.length === 0 ? (
                <p className="text-muted-foreground text-sm">This document has no signatures yet.</p>
              ) : (
                <div className="space-y-2">
                  {existingSignatures.map((s, i) => {
                    const valid = s.integrityValid && s.signatureMathValid;
                    const Icon = s.error ? ShieldAlert : valid ? ShieldCheck : ShieldAlert;
                    return (
                      <div key={i} className="flex items-start gap-2 rounded bg-muted/40 p-2 text-xs">
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", valid ? "text-green-600" : "text-amber-600")} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{s.signerName ?? s.certificateSubject}</p>
                          {s.signingTime && <p className="text-muted-foreground">Signed {s.signingTime}</p>}
                          {s.reason && <p className="text-muted-foreground">Reason: {s.reason}</p>}
                          {s.location && <p className="text-muted-foreground">Location: {s.location}</p>}
                          <p className="text-muted-foreground">
                            {s.error
                              ? s.error
                              : !s.integrityValid
                                ? "Document modified since this signature"
                                : !s.signatureMathValid
                                  ? "Signature doesn't match certificate"
                                  : s.isSelfSigned
                                    ? "Valid — self-signed (not chain-trusted)"
                                    : "Valid"}
                          </p>
                          {s.timestampGenTime && (
                            <p className="text-muted-foreground">
                              RFC3161 timestamp: {new Date(s.timestampGenTime).toLocaleString()}
                              {s.timestampAuthority && ` (${s.timestampAuthority})`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded border p-3">
              <Label className="text-xs uppercase">Signing plan</Label>
              <p className="text-muted-foreground text-xs">
                A local checklist of who needs to sign, in order — tracked here, not enforced;
                anyone can still sign out of turn using Sign with certificate.
              </p>
              {signingPlan.length > 0 && (
                <ol className="space-y-1.5">
                  {signingPlan.map((step, i) => {
                    const isSigned = signedNames.has(normalizeForMatch(step.name));
                    const priorAllSigned = signingPlan.slice(0, i).every((p) => signedNames.has(normalizeForMatch(p.name)));
                    const isNext = !isSigned && priorAllSigned;
                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
                          isNext && "border-brand bg-brand-soft"
                        )}
                      >
                        {isSigned ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground w-3.5 shrink-0 text-center">{i + 1}</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{step.name}</span>
                          {step.role && <span className="text-muted-foreground"> · {step.role}</span>}
                        </span>
                        {isSigned && <span className="text-green-600">Signed</span>}
                        {isNext && <span className="text-brand">Up next</span>}
                        <button
                          onClick={() => removeSigningStep(step.id)}
                          aria-label={`Remove ${step.name} from signing plan`}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Signer name"
                  className="h-8 text-xs"
                  value={newSignerName}
                  onChange={(e) => setNewSignerName(e.target.value)}
                />
                <Input
                  placeholder="Role (optional)"
                  className="h-8 w-28 text-xs"
                  value={newSignerRole}
                  onChange={(e) => setNewSignerRole(e.target.value)}
                />
                <Button size="sm" className="h-8 shrink-0" onClick={addSigningStep} disabled={!newSignerName.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="versions" className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Version label (e.g. before client review)"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
              />
              <Button size="sm" disabled={versionBusy} onClick={handleSaveVersion}>
                <Save className="h-3.5 w-3.5" />
                Save version
              </Button>
            </div>
            <ScrollArea className="h-52 rounded border">
              {versions.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">No saved versions yet.</p>
              ) : (
                <div className="divide-y">
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{v.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(v.timestamp).toLocaleString()} · {(v.byteLength / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Restore this version"
                        onClick={async () => {
                          const { getVersionBytes } = await import("@/lib/pdf/version-history");
                          const bytes = await getVersionBytes(v.id);
                          if (bytes) onRestoreVersion(bytes, v.fileName);
                          onOpenChange(false);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Download this version"
                        onClick={async () => {
                          const { getVersionBytes } = await import("@/lib/pdf/version-history");
                          const bytes = await getVersionBytes(v.id);
                          if (bytes) downloadLocalBytes(bytes, v.fileName.replace(/\.pdf$/i, "") + `-${v.label}.pdf`);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Delete this version"
                        onClick={() => deleteVersion(v.id).then(() => listVersions(documentId).then(setVersions))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-muted-foreground text-xs">
              Versions are snapshots of the fully exported PDF, stored locally in this browser (not uploaded
              anywhere). Restoring replaces your current in-progress edits with that snapshot.
            </p>
          </TabsContent>

          <TabsContent value="audit" className="space-y-2">
            <ScrollArea className="h-64 rounded border">
              {auditEvents.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">No activity recorded yet this session.</p>
              ) : (
                <div className="divide-y">
                  {auditEvents
                    .slice()
                    .reverse()
                    .map((e) => (
                      <div key={e.id} className="p-2 text-sm">
                        <p>
                          <span className="font-medium">{e.type}</span>
                          <span className="text-muted-foreground"> — {e.detail}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">{new Date(e.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-muted-foreground text-xs">
              This log is stored locally and is also embedded as a JSON attachment ({"audit-trail.json"}) in
              exported PDFs, so activity travels with the file — visible in the Attachments panel of this app
              or any tool that extracts embedded files.
            </p>
          </TabsContent>

          <TabsContent value="share" className="space-y-4">
            <div className="space-y-2 rounded border p-3">
              <Label className="text-xs uppercase">Secure share</Label>
              <p className="text-muted-foreground text-xs">
                Generates a strong random password, encrypts a copy with AES-256, and downloads it. Send the
                password to your recipient through a different channel (not the same email/chat as the file).
              </p>
              <Button size="sm" disabled={shareBusy} onClick={handleShare}>
                Generate password &amp; download encrypted copy
              </Button>
              {sharePassword && (
                <div className="flex items-center gap-2 rounded bg-muted p-2 font-mono text-sm">
                  <span className="flex-1 select-all">{sharePassword}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      navigator.clipboard.writeText(sharePassword);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded border p-3">
              <Label className="text-xs uppercase">Remove all metadata</Label>
              <p className="text-muted-foreground text-xs">
                Strips title/author/subject/keywords, the XMP metadata stream, and randomizes the document ID,
                then downloads a clean copy.
              </p>
              <Button size="sm" variant="outline" disabled={scrubBusy} onClick={handleScrub}>
                Scrub &amp; download
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="inspector" className="space-y-4">
            {inspecting && <p className="text-muted-foreground text-sm">Scanning document…</p>}

            {!inspecting && jsReport && (
              <div className="space-y-2 rounded border p-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 shrink-0" />
                  <Label className="text-xs uppercase">Embedded JavaScript</Label>
                </div>
                <p className="text-muted-foreground text-xs">
                  Read only — nothing here is ever executed by this app. Shown so you can judge
                  whether a PDF is doing something it shouldn&apos;t before trusting it elsewhere.
                </p>
                {!jsReport.hasAny ? (
                  <div className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    No embedded JavaScript found.
                  </div>
                ) : (
                  <>
                    {jsReport.hasFormFieldActions && (
                      <div className="flex items-center gap-1.5 text-sm text-warning">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        One or more form fields have their own script (format/validate/calculate).
                      </div>
                    )}
                    {jsReport.entries.length > 0 && (
                      <ScrollArea className="h-36 rounded border">
                        <div className="divide-y">
                          {jsReport.entries.map((entry, i) => (
                            <div key={i} className="p-2">
                              <div className="text-warning mb-1 flex items-center gap-1.5 text-xs font-medium">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {entry.where}
                              </div>
                              <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs whitespace-pre-wrap">
                                {entry.source}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}
              </div>
            )}

            {!inspecting && colorReport && (
              <div className="space-y-2 rounded border p-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 shrink-0" />
                  <Label className="text-xs uppercase">Color spaces</Label>
                </div>
                <p className="text-muted-foreground text-xs">
                  Scanned from the file&apos;s own color-space declarations — useful for
                  print-readiness checks (CMYK/ICC/spot colors), not a rendering guarantee.
                  {colorReport.partialScan && " Some embedded image streams couldn't be scanned."}
                </p>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      colorReport.hasDeviceCMYK ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {colorReport.hasDeviceCMYK ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    DeviceCMYK {colorReport.hasDeviceCMYK ? "used" : "not used"}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      colorReport.hasICCBased ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {colorReport.hasICCBased ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    ICC profile{colorReport.hasICCBased ? "s" : ""}{" "}
                    {colorReport.hasICCBased
                      ? `embedded (${colorReport.iccComponentCounts
                          .map((n) => (n === 1 ? "gray" : n === 3 ? "RGB" : n === 4 ? "CMYK" : `${n}-ch`))
                          .join(", ")})`
                      : "not found"}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      colorReport.hasSeparationOrDeviceN ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {colorReport.hasSeparationOrDeviceN ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    Spot colors (Separation/DeviceN) {colorReport.hasSeparationOrDeviceN ? "used" : "not used"}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
