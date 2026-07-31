"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

/**
 * Administrator password reset. A generated password is shown exactly once —
 * the stored hash can never be read back.
 */
export default function PasswordResetModal({ user, onClose, onUpdated }) {
  const [password, setPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const submit = async (generate) => {
    if (!generate && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generate ? {} : { password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reset password");
      if (data.user) onUpdated?.(data.user);
      if (data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
        setPassword("");
      } else {
        onClose();
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title={`Reset password · ${user.username}`}
      size="sm"
      footer={temporaryPassword ? (
        <Button onClick={onClose}>Done</Button>
      ) : (
        <>
          <Button variant="outline" disabled={saving} onClick={() => submit(true)}>Generate temporary</Button>
          <Button disabled={!password || saving} loading={saving} onClick={() => submit(false)}>Set password</Button>
        </>
      )}
    >
      {temporaryPassword ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Share this one-time password with the account owner. It is shown once and must be changed at their next sign-in.
          </p>
          <div className="flex items-center gap-2 border border-border bg-surface-2 px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-text-main">{temporaryPassword}</code>
            <button
              type="button"
              onClick={() => copy(temporaryPassword, "temp")}
              aria-label="Copy temporary password"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text-main"
            >
              <span className="material-symbols-outlined text-base">{copied === "temp" ? "check" : "content_copy"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Set a password directly, or generate a temporary one. Either way the account must choose a new password at next sign-in.
          </p>
          <Input
            label="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 6 characters."
            autoFocus
          />
          {error && (
            <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
          )}
        </div>
      )}
    </Modal>
  );
}
