"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardSkeleton, ConfirmModal, Input, Modal } from "@/shared/components";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function formatCredit(creditCents = 0) {
  return CREDIT_FORMAT.format(creditCents / 100);
}

export default function UsersPageClient() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditError, setCreditError] = useState("");

  const loadUsers = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load accounts");
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || "");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const updateUser = async (userId, change) => {
    setBusyId(userId);
    setError("");
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update account");
      setUsers((current) => current.map((user) => user.id === userId ? data.user : user));
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyId("");
    }
  };

  const adjustCredit = async (direction) => {
    if (!creditTarget) return;
    const amount = Number(creditAmount);
    const amountCents = Math.round(amount * 100);
    const isSetBalance = direction === "set";
    const invalidAmount = !Number.isFinite(amount)
      || (isSetBalance ? amount < 0 : amount <= 0)
      || Math.abs(amountCents / 100 - amount) > Number.EPSILON;
    if (invalidAmount) {
      setCreditError(
        isSetBalance
          ? "Enter a non-negative balance with no more than two decimal places."
          : "Enter a positive amount with no more than two decimal places."
      );
      return;
    }

    setBusyId(creditTarget.id);
    setError("");
    setCreditError("");
    try {
      const response = await fetch(`/api/users/${creditTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSetBalance
            ? { creditBalanceCents: amountCents }
            : { creditAdjustmentCents: direction === "add" ? amountCents : -amountCents }
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to adjust credit");
      setUsers((current) => current.map((user) => user.id === creditTarget.id ? data.user : user));
      setCreditTarget(null);
      setCreditAmount("");
    } catch (updateError) {
      setCreditError(updateError.message);
    } finally {
      setBusyId("");
    }
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError("");
    try {
      const response = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete account");
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  const activeCount = users.filter((user) => user.isActive).length;
  const adminCount = users.filter((user) => user.role === "admin" && user.isActive).length;
  const totalCreditCents = users.reduce((sum, user) => sum + (user.creditCents || 0), 0);

  return (
    <div className="flex min-w-0 flex-col gap-5 px-1 sm:px-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-border bg-surface-2 text-text-main"><span className="material-symbols-outlined">group</span></span>
          <div><p className="font-mono text-2xl font-semibold text-text-main">{users.length}</p><p className="text-xs text-text-muted">Registered accounts</p></div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-border bg-surface-2 text-text-main"><span className="material-symbols-outlined">verified_user</span></span>
          <div><p className="font-mono text-2xl font-semibold text-text-main">{activeCount}</p><p className="text-xs text-text-muted">Active accounts</p></div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-border bg-surface-2 text-text-main"><span className="material-symbols-outlined">admin_panel_settings</span></span>
          <div><p className="font-mono text-2xl font-semibold text-text-main">{adminCount}</p><p className="text-xs text-text-muted">Administrators</p></div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-border bg-surface-2 text-text-main"><span className="material-symbols-outlined">account_balance_wallet</span></span>
          <div><p className="font-mono text-2xl font-semibold text-text-main">{formatCredit(totalCreditCents)}</p><p className="text-xs text-text-muted">Total account credit</p></div>
        </Card>
      </div>

      {error && <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="font-mono font-semibold text-text-main">Account access</h2>
            <p className="mt-1 text-xs text-text-muted">Manage roles, access, credit balances, and account removal.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers}>Refresh</Button>
        </div>

        <div className="divide-y divide-border-subtle">
          {users.map((user) => {
            const isCurrent = user.id === currentUserId;
            const busy = busyId === user.id;
            return (
              <div key={user.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(210px,1fr)_140px_145px_180px_90px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-main">{user.username}</p>
                    {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">You</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-text-muted">{user.email}</p>
                  <p className="mt-1 font-mono text-[11px] text-text-muted/70">Joined {formatDate(user.createdAt)}</p>
                </div>

                <label className="flex items-center justify-between gap-3 lg:block">
                  <span className="text-xs text-text-muted lg:mb-1.5 lg:block">Role</span>
                  <select
                    value={user.role}
                    disabled={busy || isCurrent}
                    onChange={(event) => updateUser(user.id, { role: event.target.value })}
                    className="h-9 min-w-28 rounded-sm border border-border bg-surface px-3 font-mono text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <div className="flex items-center justify-between gap-3 lg:block">
                  <span className="text-xs text-text-muted lg:mb-1.5 lg:block">Status</span>
                  <button
                    type="button"
                    disabled={busy || isCurrent}
                    onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                    className={`inline-flex h-9 items-center gap-2 rounded-sm border px-3 font-mono text-xs font-medium uppercase tracking-wide transition-colors disabled:opacity-60 ${user.isActive ? "border-success/25 bg-success/10 text-success" : "border-border bg-surface-2 text-text-muted"}`}
                  >
                    <span className={`size-1.5 rounded-full ${user.isActive ? "bg-success" : "bg-text-muted"}`} />
                    {user.isActive ? "Active" : "Suspended"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 lg:block">
                  <span className="text-xs text-text-muted lg:mb-1.5 lg:block">Credit</span>
                  <div className="flex items-center gap-2">
                    <span className="min-w-20 font-mono text-sm font-semibold text-text-main tabular-nums">
                      {formatCredit(user.creditCents)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setCreditTarget(user);
                        setCreditAmount("");
                        setError("");
                        setCreditError("");
                      }}
                    >
                      Adjust
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" disabled={busy || isCurrent} onClick={() => setDeleteTarget(user)} className="text-danger hover:bg-danger/10">Remove</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        isOpen={!!creditTarget}
        onClose={() => {
          if (busyId) return;
          setCreditTarget(null);
          setCreditAmount("");
          setCreditError("");
        }}
        title={`Adjust credit · ${creditTarget?.username || ""}`}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              disabled={!creditAmount || !!busyId}
              onClick={() => adjustCredit("deduct")}
            >
              Deduct
            </Button>
            <Button
              variant="secondary"
              disabled={creditAmount === "" || !!busyId}
              onClick={() => adjustCredit("set")}
            >
              Set balance
            </Button>
            <Button
              disabled={!creditAmount || !!busyId}
              loading={!!busyId}
              onClick={() => adjustCredit("add")}
            >
              Add credit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="border border-border bg-bg-alt/60 px-4 py-3">
            <p className="text-xs text-text-muted">Current balance</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-text-main tabular-nums">
              {formatCredit(creditTarget?.creditCents)}
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
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
            hint="Add or deduct an amount, or replace the balance exactly. Credit cannot go below $0.00."
            autoFocus
          />
          {creditError && (
            <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
              {creditError}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteUser}
        title="Remove account"
        message={`Remove ${deleteTarget?.username || "this account"} and all API keys owned by it? This cannot be undone.`}
        confirmText="Remove account"
        cancelText="Cancel"
        variant="danger"
        loading={!!deleteTarget && busyId === deleteTarget.id}
      />
    </div>
  );
}
