"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, ConfirmModal, PeriodDropdown, SegmentedControl, StatTile } from "@/shared/components";
import { getRelativeTime } from "@/shared/utils";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import RequestDetailsTab from "@/app/(dashboard)/dashboard/usage/components/RequestDetailsTab";
import ActionMenu from "../components/ActionMenu";
import CreditAdjustModal from "../components/CreditAdjustModal";
import EditIdentityModal from "../components/EditIdentityModal";
import PasswordResetModal from "../components/PasswordResetModal";
import { getUsagePeriodLabel } from "@/shared/constants/usagePeriods";
import {
  COMPACT_FORMAT,
  COST_FORMAT,
  NUMBER_FORMAT,
  formatCredit,
  formatDateTime,
  formatSignedCredit,
  initials,
  ledgerLabel,
  maskKey,
} from "../components/userFormat";
import { Icon } from "@/shared/components/ui/icon";

/** Accounts are long-lived, so a month of history is the useful default here. */
const DEFAULT_PERIOD = "30d";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "keys", label: "API keys" },
  { value: "credit", label: "Credit" },
  { value: "requests", label: "Requests" },
];

function CopyButton({ value, copiedId, onCopy, label }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value, label)}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <Icon name={copiedId === label ? "check" : "content_copy"} className="size-[15px]" />
    </button>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <dt className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-center gap-1.5 break-all text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function UserDetailsClient({ initialUser, currentUserId }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleKeys, setVisibleKeys] = useState(() => new Set());
  const [creditOpen, setCreditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const isCurrent = user.id === currentUserId;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${initialUser.id}/details?period=${period}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load account details");
      setData(body);
      if (body.user) setUser(body.user);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [initialUser.id, period]);

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const patchUser = async (change) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update account");
      setUser(body.user);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to delete account");
      router.push("/dashboard/users");
    } catch (reason) {
      setError(reason.message);
      setSaving(false);
      setDeleteOpen(false);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys((current) => {
      const next = new Set(current);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const stats = data?.stats;
  const apiKeys = data?.apiKeys || [];
  const ledger = data?.ledger?.entries || [];
  const models = useMemo(
    () => Object.values(stats?.byModel || {}).sort((a, b) => b.requests - a.requests),
    [stats],
  );
  const totalTokens = (stats?.totalPromptTokens || 0) + (stats?.totalCompletionTokens || 0);
  const statusCounts = stats?.byStatus || {};
  const statusTotal = Object.values(statusCounts).reduce((sum, count) => sum + (count || 0), 0);
  const successRate = statusTotal ? Math.round(((statusCounts.success || 0) / statusTotal) * 100) : null;
  const lastRequestAt = stats?.recentRequests?.[0]?.timestamp || null;
  const activeKeys = apiKeys.filter((key) => key.isActive).length;
  const periodLabel = getUsagePeriodLabel(period);

  const menuItems = [
    { label: "Edit identity", icon: "badge", onSelect: () => setEditOpen(true) },
    { label: "Reset password", icon: "lock_reset", onSelect: () => setResetOpen(true) },
    {
      label: user.isActive ? "Suspend account" : "Reactivate account",
      icon: user.isActive ? "block" : "check_circle",
      disabled: isCurrent || saving,
      onSelect: () => patchUser({ isActive: !user.isActive }),
    },
    {
      label: copied === "account ID" ? "Account ID copied" : "Copy account ID",
      icon: copied === "account ID" ? "check" : "content_copy",
      onSelect: () => copy(user.id, "account ID"),
    },
    {
      label: "Remove account",
      icon: "delete",
      danger: true,
      disabled: isCurrent || saving,
      onSelect: () => setDeleteOpen(true),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Back navigation is provided by the Header breadcrumb for this route. */}
      <div className="border border-border bg-surface">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-base font-semibold text-foreground">
              {initials(user.username)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-mono text-xl font-semibold tracking-[-0.03em] text-foreground">{user.username}</h1>
                <Badge variant={user.role === "admin" ? "info" : "default"}>{user.role}</Badge>
                <Badge variant={user.isActive ? "success" : "error"} dot>{user.isActive ? "Active" : "Suspended"}</Badge>
                {isCurrent && <Badge variant="outline">You</Badge>}
                {user.mustChangePassword && <Badge variant="warning">Password reset pending</Badge>}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Joined {formatDateTime(user.createdAt)}
                {lastRequestAt ? ` · last request ${getRelativeTime(lastRequestAt)}` : " · no requests yet"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodDropdown value={period} onChange={setPeriod} />
            <Button variant="ghost" size="sm" icon="refresh" loading={loading} onClick={load}>Refresh</Button>
            <Button size="sm" icon="account_balance_wallet" onClick={() => setCreditOpen(true)}>Adjust credit</Button>
            <ActionMenu items={menuItems} label={`Actions for ${user.username}`} />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="tile-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          chip="cost"
          label="Credit balance"
          value={formatCredit(user.creditCents)}
          sub="Debited automatically as usage is billed"
        />
        <StatTile
          chip="requests"
          label={`Requests · ${periodLabel}`}
          value={loading ? "…" : NUMBER_FORMAT.format(stats?.totalRequests || 0)}
          sub={successRate === null ? "No requests in this period" : `${successRate}% completed successfully`}
        />
        <StatTile
          chip="tokens"
          label={`Tokens · ${periodLabel}`}
          value={loading ? "…" : COMPACT_FORMAT.format(totalTokens)}
          sub={`${COMPACT_FORMAT.format(stats?.totalPromptTokens || 0)} in · ${COMPACT_FORMAT.format(stats?.totalCompletionTokens || 0)} out`}
        />
        <StatTile
          chip="cost"
          label={`Estimated cost · ${periodLabel}`}
          value={loading ? "…" : COST_FORMAT.format(stats?.totalCost || 0)}
          sub="Routing cost across all owned keys"
        />
      </div>

      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={setTab}
        className="w-full sm:w-auto"
      />

      {tab === "overview" && (

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <Card padding="none" className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 className="font-mono text-sm font-semibold text-foreground">Account information</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Identity and security metadata visible to administrators.</p>
            </div>
            <Button variant="outline" size="sm" icon="edit" onClick={() => setEditOpen(true)}>Edit</Button>
          </div>
          <dl className="grid gap-px bg-border-subtle sm:grid-cols-2">
            <InfoRow label="Username"><span className="font-mono">{user.username}</span></InfoRow>
            <InfoRow label="Email">
              <span className="min-w-0 flex-1 truncate font-mono" title={user.email}>{user.email}</span>
              <CopyButton value={user.email} copiedId={copied} onCopy={copy} label="email" />
            </InfoRow>
            <InfoRow label="Account ID">
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={user.id}>{user.id}</span>
              <CopyButton value={user.id} copiedId={copied} onCopy={copy} label="account ID" />
            </InfoRow>
            <InfoRow label="Role"><span className="font-mono capitalize">{user.role}</span></InfoRow>
            <InfoRow label="Created"><span>{formatDateTime(user.createdAt)}</span></InfoRow>
            <InfoRow label="Last updated">
              <span title={formatDateTime(user.updatedAt)}>
                {user.updatedAt ? `${formatDateTime(user.updatedAt)} · ${getRelativeTime(user.updatedAt)}` : "—"}
              </span>
            </InfoRow>
            <InfoRow label="Last request">
              <span>{lastRequestAt ? `${formatDateTime(lastRequestAt)} · ${getRelativeTime(lastRequestAt)}` : "Never"}</span>
            </InfoRow>
            <InfoRow label="Password">
              <span>{user.mustChangePassword ? "Must be changed at next sign-in" : "Encrypted · cannot be viewed"}</span>
            </InfoRow>
          </dl>
          <div className="border-t border-border-subtle px-5 py-3 text-xs text-muted-foreground">
            Passwords are stored as one-way hashes. An admin can reset a password, but an existing password can never be displayed.
          </div>
        </Card>

        <Card padding="none" className="min-w-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Access &amp; security</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Role, sign-in access, and credential actions.</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">Role</span>
              <select
                value={user.role}
                disabled={saving || isCurrent}
                onChange={(event) => patchUser({ role: event.target.value })}
                className="mt-1.5 h-9 w-full rounded-sm border border-border bg-surface px-3 font-mono text-sm text-foreground focus-visible:border-primary focus-visible:outline-none disabled:opacity-60"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <div>
              <span className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">Dashboard access</span>
              <button
                type="button"
                disabled={saving || isCurrent}
                onClick={() => patchUser({ isActive: !user.isActive })}
                className={`mt-1.5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border font-mono text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                  user.isActive
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-border bg-surface-2 text-muted-foreground"
                }`}
              >
                <span className={`size-1.5 ${user.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                {user.isActive ? "Active · click to suspend" : "Suspended · click to reactivate"}
              </button>
            </div>

            {isCurrent && (
              <p className="border border-border bg-bg-alt/60 px-3 py-2 text-xs text-muted-foreground">
                This is your own account — role, access, and removal are locked to prevent losing administrator access.
              </p>
            )}

            <div className="grid gap-2">
              <Button variant="outline" size="sm" icon="lock_reset" fullWidth onClick={() => setResetOpen(true)}>
                Reset password
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="delete"
                fullWidth
                disabled={isCurrent || saving}
                onClick={() => setDeleteOpen(true)}
              >
                Remove account
              </Button>
            </div>
          </div>
        </Card>
      </div>
      )}

      {tab === "keys" && (
      <Card padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">API keys</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {apiKeys.length
                ? `${activeKeys} active of ${apiKeys.length} · usage shown for ${periodLabel.toLowerCase()}`
                : "Keys owned by this account."}
            </p>
          </div>
        </div>
        {apiKeys.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Icon name="key_off" className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">No API keys</p>
            <p className="mt-1 text-xs text-muted-foreground">This account cannot call the gateway until it creates a key.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="thead-data">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Key</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Requests</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Tokens</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {apiKeys.map((key) => {
                  const isVisible = visibleKeys.has(key.id);
                  const keyName = key.name || "Unnamed key";
                  const usage = key.usage;
                  return (
                    <tr key={key.id} className="hover:bg-bg-alt/50">
                      <td className="px-5 py-3">
                        <p className="truncate text-sm font-medium text-foreground">{keyName}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <code className="min-w-0 break-all font-mono text-[11px] text-muted-foreground" title={isVisible ? key.key : undefined}>
                            {isVisible ? key.key : maskKey(key.key)}
                          </code>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(key.id)}
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                            title={isVisible ? "Hide key" : "Show key"}
                            aria-label={isVisible ? `Hide ${keyName}` : `Show ${keyName}`}
                          >
                            <Icon name={isVisible ? "visibility_off" : "visibility"} className="size-[15px]" />
                          </button>
                          <CopyButton value={key.key} copiedId={copied} onCopy={copy} label={keyName} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={key.isActive ? "success" : "default"} size="sm" dot>
                          {key.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                        {usage ? NUMBER_FORMAT.format(usage.requests) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                        {usage ? COMPACT_FORMAT.format((usage.promptTokens || 0) + (usage.completionTokens || 0)) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                        {usage ? COST_FORMAT.format(usage.cost || 0) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(key.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}

      {tab === "credit" && (
      <Card padding="none">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="font-mono text-sm font-semibold text-foreground">Credit history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Top-ups, deductions, and signup credit. Per-request usage charges are tracked under usage, not here.
          </p>
        </div>
        {ledger.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Icon name="receipt_long" className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">No credit activity</p>
            <p className="mt-1 text-xs text-muted-foreground">Adjustments made from this page will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="thead-data">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">When</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Details</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Balance after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {ledger.map((entry) => {
                  const positive = (entry.amountCents || 0) > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-bg-alt/50">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Badge size="sm" variant={positive ? "success" : "error"}>{entry.type || "adjustment"}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-foreground">{ledgerLabel(entry)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.source || "—"}</p>
                      </td>
                      <td className={`px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums ${positive ? "text-success" : "text-danger"}`}>
                        {formatSignedCredit(entry.amountCents)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                        {formatCredit(entry.balanceAfterCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data?.ledger?.total > ledger.length && (
          <div className="border-t border-border-subtle px-5 py-3 text-xs text-muted-foreground">
            Showing the {ledger.length} most recent of {data.ledger.total} entries.
          </div>
        )}
      </Card>
      )}

      {tab === "requests" && (
      <div className="flex min-w-0 flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="none" className="min-w-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Usage by model</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel} · sorted by request volume</p>
          </div>
          <div className="max-h-[420px] divide-y divide-border-subtle overflow-auto">
            {models.slice(0, 30).map((model, index) => (
              <div key={`${model.rawModel}-${model.provider}-${index}`} className="flex justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{model.rawModel || "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{model.provider || "Unknown provider"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums text-foreground">{NUMBER_FORMAT.format(model.requests)} req</p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {COMPACT_FORMAT.format((model.promptTokens || 0) + (model.completionTokens || 0))} tokens · {COST_FORMAT.format(model.cost || 0)}
                  </p>
                </div>
              </div>
            ))}
            {!models.length && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No usage in this period.</p>}
          </div>
        </Card>

        <Card padding="none" className="min-w-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Recent activity</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Latest requests made with this account&apos;s keys</p>
          </div>
          <div className="max-h-[420px] divide-y divide-border-subtle overflow-auto">
            {(stats?.recentRequests || []).map((request, index) => (
              <div key={`${request.timestamp}-${index}`} className="flex justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{request.model}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {request.provider} · <span title={formatDateTime(request.timestamp)}>{getRelativeTime(request.timestamp)}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums text-foreground">
                    {NUMBER_FORMAT.format((request.promptTokens || 0) + (request.completionTokens || 0))} tokens
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">{request.status}</p>
                </div>
              </div>
            ))}
            {!stats?.recentRequests?.length && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No recent activity.</p>}
          </div>
        </Card>
      </div>

      <RequestDetailsTab period={period} userId={user.id} />
      </div>
      )}

      {creditOpen && (
        <CreditAdjustModal
          user={user}
          onClose={() => setCreditOpen(false)}
          onUpdated={(updated) => setUser(updated)}
        />
      )}
      {resetOpen && (
        <PasswordResetModal
          user={user}
          onClose={() => setResetOpen(false)}
          onUpdated={(updated) => setUser(updated)}
        />
      )}
      {editOpen && (
        <EditIdentityModal
          user={user}
          onClose={() => setEditOpen(false)}
          onUpdated={(updated) => setUser(updated)}
        />
      )}

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteAccount}
        title="Remove account"
        message={`Remove ${user.username} and all API keys owned by it? This cannot be undone.`}
        confirmText="Remove account"
        cancelText="Cancel"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
