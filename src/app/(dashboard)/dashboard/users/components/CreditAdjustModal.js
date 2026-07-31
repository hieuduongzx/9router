"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/shared/components";
import { formatCredit } from "./userFormat";

/**
 * Credit top-up / deduction / exact balance for one account.
 * Mounted only while open so each account starts from a clean form.
 */
export default function CreditAdjustModal({ user, onClose, onUpdated }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (direction) => {
    const value = Number(amount);
    const cents = Math.round(value * 100);
    const isSetBalance = direction === "set";
    const invalid = !Number.isFinite(value)
      || (isSetBalance ? value < 0 : value <= 0)
      || Math.abs(cents / 100 - value) > Number.EPSILON;
    if (invalid) {
      setError(isSetBalance
        ? "Enter a non-negative balance with no more than two decimal places."
        : "Enter a positive amount with no more than two decimal places.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSetBalance
            ? { creditBalanceCents: cents }
            : { creditAdjustmentCents: direction === "add" ? cents : -cents },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to adjust credit");
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
      title={`Adjust credit · ${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={!amount || saving} onClick={() => submit("deduct")}>Deduct</Button>
          <Button variant="secondary" disabled={amount === "" || saving} onClick={() => submit("set")}>Set balance</Button>
          <Button disabled={!amount || saving} loading={saving} onClick={() => submit("add")}>Add credit</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="border border-border bg-bg-alt/60 px-4 py-3">
          <p className="text-xs text-text-muted">Current balance</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-main">
            {formatCredit(user.creditCents)}
          </p>
        </div>
        <Input
          label="Amount"
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          inputMode="decimal"
          icon="attach_money"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint="Add or deduct an amount, or replace the balance exactly. Credit cannot go below $0.00."
          autoFocus
        />
        {error && (
          <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        )}
      </div>
    </Modal>
  );
}
