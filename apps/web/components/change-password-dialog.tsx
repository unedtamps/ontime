"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { api, ApiError } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setDone(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current one");
      return;
    }

    setSaving(true);
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message);
      } else {
        setError("Could not change the password, try again");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {done
              ? "Your password has been changed."
              : "Enter your current password, then choose a new one"}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <DialogFooter>
            <Button variant="primary" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={submit}>
            <InputGroup className="w-full">
              <InputField
                label="Current password"
                index={0}
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
              <InputField
                label="New password"
                index={1}
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <InputField
                label="Confirm new password"
                index={2}
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </InputGroup>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <div className="text-caption text-destructive">
                {6 - newPassword.length} more character
                {6 - newPassword.length === 1 ? "" : "s"} needed
              </div>
            )}
            {error && (
              <div className="mt-2 text-caption text-destructive">{error}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Change password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
