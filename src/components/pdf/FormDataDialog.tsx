"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  collectAllFormFields,
  exportFormDataFdf,
  exportFormDataJson,
  exportFormDataXfdf,
  matchProfileField,
  parseFormData,
  type DocPage,
  type PdfDocumentProxy,
  type FormFieldDef,
  type AutoFillProfile,
} from "@folio/engine";
import { loadAutoFillProfile, saveAutoFillProfile } from "@/lib/pdf/autofill-profile";

type FormDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: DocPage[];
  pdfjsDocs: Map<string, PdfDocumentProxy>;
  fileName: string;
  onFieldChange: (pageId: string, field: FormFieldDef, value: string) => void;
};

function download(text: string, name: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function currentFieldValue(field: FormFieldDef, page: DocPage): string {
  const ann = page.annotations.find((a) => a.type === "form-field" && a.fieldName === field.fieldName);
  if (ann && ann.type === "form-field") return ann.value;
  return field.initialValue;
}

export function FormDataDialog({ open, onOpenChange, pages, pdfjsDocs, fileName, onFieldChange }: FormDataDialogProps) {
  const [profile, setProfile] = useState<AutoFillProfile>(() => loadAutoFillProfile());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAutoFill() {
    setBusy(true);
    setStatus(null);
    try {
      saveAutoFillProfile(profile);
      const fields = await collectAllFormFields(pages, pdfjsDocs);
      let filled = 0;
      for (const { page, field } of fields) {
        if (field.kind !== "text") continue;
        const match = matchProfileField(field.fieldName, profile);
        if (match) {
          onFieldChange(page.id, field, match);
          filled++;
        }
      }
      setStatus(`Filled ${filled} matching field${filled === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  }

  async function currentValues(): Promise<Record<string, string>> {
    const fields = await collectAllFormFields(pages, pdfjsDocs);
    const values: Record<string, string> = {};
    for (const { page, field } of fields) {
      const v = currentFieldValue(field, page);
      if (v) values[field.fieldName] = v;
    }
    return values;
  }

  async function handleExport(format: "json" | "fdf" | "xfdf") {
    const values = await currentValues();
    const base = fileName.replace(/\.pdf$/i, "");
    if (format === "json") download(exportFormDataJson(values), `${base}-form-data.json`, "application/json");
    else if (format === "fdf") download(exportFormDataFdf(values), `${base}-form-data.fdf`, "application/vnd.fdf");
    else download(exportFormDataXfdf(values), `${base}-form-data.xfdf`, "application/vnd.adobe.xfdf+xml");
  }

  async function handleImport(file: File) {
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const values = parseFormData(text, file.name);
      const fields = await collectAllFormFields(pages, pdfjsDocs);
      let filled = 0;
      for (const { page, field } of fields) {
        if (field.fieldName in values) {
          onFieldChange(page.id, field, values[field.fieldName]);
          filled++;
        }
      }
      setStatus(`Imported ${filled} field value${filled === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Form data</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="autofill">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="autofill">Auto-fill</TabsTrigger>
            <TabsTrigger value="io">Import / export</TabsTrigger>
          </TabsList>

          <TabsContent value="autofill" className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Saved locally in this browser. Matches this document&apos;s text fields by name (e.g. a
              field named &quot;Email&quot; gets your email).
            </p>
            <Input placeholder="Full name" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
            <Input placeholder="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <Input placeholder="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Input placeholder="Address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            <div className="flex gap-2">
              <Input placeholder="City" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
              <Input placeholder="State" value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} />
              <Input placeholder="ZIP" value={profile.zip} onChange={(e) => setProfile({ ...profile, zip: e.target.value })} />
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                saveAutoFillProfile(profile);
                handleAutoFill();
              }}
            >
              Save profile &amp; auto-fill this document
            </Button>
          </TabsContent>

          <TabsContent value="io" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Export current values</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleExport("json")}>
                  JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport("fdf")}>
                  FDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport("xfdf")}>
                  XFDF
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs uppercase">Import values</Label>
              <Input
                type="file"
                accept=".json,.fdf,.xfdf,application/json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                  e.target.value = "";
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {status && <p className="text-muted-foreground text-xs">{status}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
