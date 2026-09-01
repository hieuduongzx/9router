"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/shared/components";

/** Administrator edit of an account's username / email. */
export default function EditIdentityModal({ user, onClose, onUpdated }) {
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = username !== (user.username || "") || email !== (user.email || "");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update account");
      onUpdated(data.user);
      onClose();
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
      title={`Edit identity · ${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={!dirty || saving} loading={saving} onClick={submit}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          hint="3–32 characters: letters, numbers, dots, underscores, hyphens."
          autoFocus
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          The account signs in with either the username or the email, so a change here changes their login.
        </p>
        {error && (
          <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        )}
      </div>
    </Modal>
  );
}
