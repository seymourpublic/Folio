"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OpenPasswordPromptProps = {
  wasIncorrect: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export function OpenPasswordPrompt({ wasIncorrect, onSubmit, onCancel }: OpenPasswordPromptProps) {
  const [password, setPassword] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Password required</DialogTitle>
          <DialogDescription>
            {wasIncorrect
              ? "That password was incorrect. Try again."
              : "This PDF is password-protected. Enter the password to open it."}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) onSubmit(password);
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!password} onClick={() => onSubmit(password)}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
