"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { EncryptionOptions } from "@folio/engine/signing";

type PasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encryption: EncryptionOptions | null;
  onApply: (encryption: EncryptionOptions | null) => void;
};

const DEFAULTS: EncryptionOptions = {
  userPassword: "",
  ownerPassword: "",
  permissions: { printing: true, copying: true, modifying: true, annotating: true },
};

export function PasswordDialog({ open, onOpenChange, encryption, onApply }: PasswordDialogProps) {
  const [draft, setDraft] = useState<EncryptionOptions>(encryption ?? DEFAULTS);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(encryption ?? DEFAULTS);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Password protect</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Password to open the document</Label>
            <Input
              type="password"
              value={draft.userPassword}
              onChange={(e) => setDraft({ ...draft, userPassword: e.target.value })}
              placeholder="Required to view"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Owner password (optional)</Label>
            <Input
              type="password"
              value={draft.ownerPassword}
              onChange={(e) => setDraft({ ...draft, ownerPassword: e.target.value })}
              placeholder="Controls permissions — defaults to the same password"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Encryption strength</Label>
            <div className="flex gap-2">
              {(
                [
                  [128, "AES-128 (standard)"],
                  [256, "AES-256 (stronger)"],
                ] as const
              ).map(([bits, label]) => (
                <button
                  key={bits}
                  type="button"
                  onClick={() => setDraft({ ...draft, aesKeyBits: bits })}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    (draft.aesKeyBits ?? 128) === bits
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-accent/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-muted-foreground text-xs uppercase">
              Permissions (advisory — honored by compliant viewers)
            </Label>
            {(
              [
                ["printing", "Allow printing"],
                ["copying", "Allow copying text & images"],
                ["modifying", "Allow document editing"],
                ["annotating", "Allow comments & form filling"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={key}
                  checked={draft.permissions[key]}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, permissions: { ...draft.permissions, [key]: Boolean(checked) } })
                  }
                />
                <Label htmlFor={key} className="text-sm font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {encryption && (
            <Button
              variant="ghost"
              onClick={() => {
                onApply(null);
                onOpenChange(false);
              }}
            >
              Remove password
            </Button>
          )}
          <Button
            disabled={!draft.userPassword.trim()}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
