"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  CardSkeleton,
  ConfirmModal,
  Input,
  Modal,
  PeriodDropdown,
  StatTile,
} from "@/shared/components";
import { getRelativeTime } from "@/shared/utils";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import ActionMenu from "./components/ActionMenu";
import CreditAdjustModal from "./components/CreditAdjustModal";
import PasswordResetModal from "./components/PasswordResetModal";
import { getUsagePeriodLabel } from "@/shared/constants/usagePeriods";
import {
  COST_FORMAT,
  NUMBER_FORMAT,
  formatCredit,
  formatDate,
  formatDateTime,
  initials,
} from "./components/userFormat";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "credit", label: "Highest credit" },
  { value: "requests", label: "Most requests" },
  { value: "active", label: "Recently active" },
];

/** Accounts are long-lived, so a month of history is the useful default here. */
const DEFAULT_PERIOD = "30d";
const EMPTY_DRAFT = { username: "", email: "", password: "", role: "user", credit: "" };
const FILTER_SELECT_CLASS = "h-8 rounded-sm border border-border bg-surface px-2 font-mono text-xs text-text-main focus-visible:border-primary focus-visible:outline-none";

export default function UsersPageClient() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [unassignedKeyCount, setUnassignedKeyCount] = useState(0);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("recent");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const loadUsers = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/users?period=${period}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load accounts");
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || "");
      setUnassignedKeyCount(data.unassignedKeyCount || 0);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const replaceUser = (updated) => {
    if (!updated?.id) return;
    setUsers((current) => current.map((user) => (user.id === updated.id ? { ...user, ...updated } : user)));
  };

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
      replaceUser(data.user);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyId("");
    }
  };

  const createAccount = async () => {
    const credit = draft.credit === "" ? 0 : Number(draft.credit);
    if (!Number.isFinite(credit) || credit < 0) {
      setCreateError("Starting credit must be a non-negative amount.");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: draft.username,
          email: draft.email,
          password: draft.password,
          role: draft.role,
          initialCreditCents: Math.round(credit * 100),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create account");
      setCreateOpen(false);
      setDraft(EMPTY_DRAFT);
      await loadUsers();
    } catch (createFailure) {
      setCreateError(createFailure.message);
    } finally {
      setCreating(false);
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

  const totals = useMemo(() => ({
    active: users.filter((user) => user.isActive).length,
    suspended: users.filter((user) => !user.isActive).length,
    admins: users.filter((user) => user.role === "admin" && user.isActive).length,
    creditCents: users.reduce((sum, user) => sum + (user.creditCents || 0), 0),
    requests: users.reduce((sum, user) => sum + (user.requestsInPeriod || 0), 0),
    cost: users.reduce((sum, user) => sum + (user.costInPeriod || 0), 0),
    keys: users.reduce((sum, user) => sum + (user.apiKeyCount || 0), 0),
  }), [users]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "suspended" && user.isActive) return false;
      if (!query) return true;
      return [user.username, user.email, user.id].some((field) => String(field || "").toLowerCase().includes(query));
    });

    const byTime = (value) => (value ? new Date(value).getTime() : 0);
    const sorters = {
      recent: (a, b) => byTime(b.createdAt) - byTime(a.createdAt),
      oldest: (a, b) => byTime(a.createdAt) - byTime(b.createdAt),
      name: (a, b) => String(a.username || "").localeCompare(String(b.username || "")),
      credit: (a, b) => (b.creditCents || 0) - (a.creditCents || 0),
      requests: (a, b) => (b.requestsInPeriod || 0) - (a.requestsInPeriod || 0),
      active: (a, b) => byTime(b.lastUsedAt) - byTime(a.lastUsedAt),
    };
    return filtered.sort(sorters[sort] || sorters.recent);
  }, [users, search, roleFilter, statusFilter, sort]);

  const filtersActive = Boolean(search.trim()) || roleFilter !== "all" || statusFilter !== "all";
  const periodLabel = getUsagePeriodLabel(period);

  const buildMenu = (user) => {
    const isCurrent = user.id === currentUserId;
    return [
      { label: "View details", icon: "open_in_new", onSelect: () => router.push(`/dashboard/users/${user.id}`) },
      { label: "Adjust credit", icon: "account_balance_wallet", onSelect: () => { setError(""); setCreditTarget(user); } },
      { label: "Reset password", icon: "lock_reset", onSelect: () => { setError(""); setResetTarget(user); } },
      {
        label: user.isActive ? "Suspend account" : "Reactivate account",
        icon: user.isActive ? "block" : "check_circle",
        disabled: isCurrent,
        onSelect: () => updateUser(user.id, { isActive: !user.isActive }),
      },
      {
        label: copied === user.id ? "Account ID copied" : "Copy account ID",
        icon: copied === user.id ? "check" : "content_copy",
        onSelect: () => copy(user.id, user.id),
      },
      {
        label: "Remove account",
        icon: "delete",
        danger: true,
        disabled: isCurrent,
        onSelect: () => setDeleteTarget(user),
      },
    ];
  };

  if (loading) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="tile-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          chip="info"
          label="Accounts"
          value={NUMBER_FORMAT.format(users.length)}
          sub={`${totals.active} active · ${totals.suspended} suspended`}
        />
        <StatTile
          chip="requests"
          label="Administrators"
          value={NUMBER_FORMAT.format(totals.admins)}
          sub={`${totals.keys} API keys owned${unassignedKeyCount ? ` · ${unassignedKeyCount} unassigned` : ""}`}
        />
        <StatTile
          chip="cost"
          label="Total credit"
          value={formatCredit(totals.creditCents)}
          sub="Sum of all account balances"
        />
        <StatTile
          chip="tokens"
          label={`Requests · ${periodLabel}`}
          value={NUMBER_FORMAT.format(totals.requests)}
          sub={`${COST_FORMAT.format(totals.cost)} estimated spend`}
        />
      </div>

      {error && (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold text-text-main">Accounts</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {visibleUsers.length === users.length
                ? `${users.length} account${users.length === 1 ? "" : "s"}`
                : `${visibleUsers.length} of ${users.length} accounts`}
              {" · roles, access, credit, and usage"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search username, email, ID"
                aria-label="Search accounts"
                className="h-8 w-full rounded-sm border border-border bg-surface pl-8 pr-3 font-mono text-xs text-text-main placeholder:font-sans focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role" className={FILTER_SELECT_CLASS}>
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" className={FILTER_SELECT_CLASS}>
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort accounts" className={FILTER_SELECT_CLASS}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <PeriodDropdown value={period} onChange={setPeriod} />
            <Button variant="ghost" size="sm" icon="refresh" loading={refreshing} onClick={loadUsers}>Refresh</Button>
            <Button size="sm" icon="person_add" onClick={() => { setDraft(EMPTY_DRAFT); setCreateError(""); setCreateOpen(true); }}>
              New account
            </Button>
          </div>
        </div>

        {visibleUsers.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <span className="material-symbols-outlined text-3xl text-text-muted">group_off</span>
            <p className="mt-2 text-sm font-medium text-text-main">
              {filtersActive ? "No accounts match these filters" : "No accounts yet"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {filtersActive ? "Clear the search or filters to see every account." : "Create the first account to grant dashboard access."}
            </p>
            {filtersActive && (
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: dense table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b border-border-subtle bg-bg-alt/70 font-mono text-[11px] uppercase tracking-wide text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Credit</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Keys</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Requests</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Last active</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {visibleUsers.map((user) => {
                    const isCurrent = user.id === currentUserId;
                    const busy = busyId === user.id;
                    return (
                      <tr key={user.id} className={`transition-colors hover:bg-bg-alt/50 ${busy ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-xs font-semibold text-text-main">
                              {initials(user.username)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link href={`/dashboard/users/${user.id}`} className="truncate font-mono text-sm font-semibold text-text-main hover:text-primary">
                                  {user.username}
                                </Link>
                                {isCurrent && <Badge size="sm" variant="info">You</Badge>}
                                {user.mustChangePassword && (
                                  <span title="Must choose a new password at next sign-in">
                                    <Badge size="sm" variant="warning">Reset</Badge>
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-text-muted">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.role}
                            disabled={busy || isCurrent}
                            aria-label={`Role for ${user.username}`}
                            onChange={(event) => updateUser(user.id, { role: event.target.value })}
                            className="h-8 rounded-sm border border-border bg-surface px-2 font-mono text-xs text-text-main focus-visible:border-primary focus-visible:outline-none disabled:opacity-60"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            disabled={busy || isCurrent}
                            onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                            title={isCurrent ? "You cannot change your own access" : user.isActive ? "Suspend account" : "Reactivate account"}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                              user.isActive
                                ? "border-success/25 bg-success/10 text-success"
                                : "border-border bg-surface-2 text-text-muted"
                            }`}
                          >
                            <span className={`size-1.5 ${user.isActive ? "bg-success" : "bg-text-muted"}`} />
                            {user.isActive ? "Active" : "Suspended"}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setError(""); setCreditTarget(user); }}
                            title="Adjust credit"
                            className="font-mono text-sm font-semibold tabular-nums text-text-main underline-offset-4 hover:text-primary hover:underline disabled:opacity-60"
                          >
                            {formatCredit(user.creditCents)}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-text-main">
                          {user.apiKeyCount ? (
                            <span title={`${user.activeApiKeyCount} active of ${user.apiKeyCount}`}>
                              {user.activeApiKeyCount}
                              <span className="text-text-muted">/{user.apiKeyCount}</span>
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-mono text-sm tabular-nums text-text-main">{NUMBER_FORMAT.format(user.requestsInPeriod || 0)}</p>
                          <p className="font-mono text-[11px] tabular-nums text-text-muted">{COST_FORMAT.format(user.costInPeriod || 0)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs text-text-main" title={formatDateTime(user.lastUsedAt)}>
                            {user.lastUsedAt ? getRelativeTime(user.lastUsedAt) : "Never"}
                          </p>
                          <p className="font-mono text-[11px] text-text-muted">Joined {formatDate(user.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/dashboard/users/${user.id}`}
                              className="inline-flex h-8 items-center rounded-sm border border-border px-2.5 font-mono text-xs text-text-main transition-colors hover:bg-surface-2"
                            >
                              Details
                            </Link>
                            <ActionMenu items={buildMenu(user)} label={`Actions for ${user.username}`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="divide-y divide-border-subtle lg:hidden">
              {visibleUsers.map((user) => {
                const isCurrent = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <div key={user.id} className={`px-4 py-4 ${busy ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-sm font-semibold text-text-main">
                          {initials(user.username)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`/dashboard/users/${user.id}`} className="truncate font-mono text-sm font-semibold text-text-main">
                              {user.username}
                            </Link>
                            {isCurrent && <Badge size="sm" variant="info">You</Badge>}
                            {user.mustChangePassword && <Badge size="sm" variant="warning">Reset</Badge>}
                          </div>
                          <p className="truncate text-xs text-text-muted">{user.email}</p>
                        </div>
                      </div>
                      <ActionMenu items={buildMenu(user)} label={`Actions for ${user.username}`} />
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-text-muted">Role</dt>
                        <dd className="mt-0.5">
                          <select
                            value={user.role}
                            disabled={busy || isCurrent}
                            aria-label={`Role for ${user.username}`}
                            onChange={(event) => updateUser(user.id, { role: event.target.value })}
                            className="h-8 w-full rounded-sm border border-border bg-surface px-2 font-mono text-xs text-text-main disabled:opacity-60"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Status</dt>
                        <dd className="mt-0.5">
                          <button
                            type="button"
                            disabled={busy || isCurrent}
                            onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                            className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border font-mono text-[11px] font-semibold uppercase tracking-wide disabled:opacity-60 ${
                              user.isActive
                                ? "border-success/25 bg-success/10 text-success"
                                : "border-border bg-surface-2 text-text-muted"
                            }`}
                          >
                            <span className={`size-1.5 ${user.isActive ? "bg-success" : "bg-text-muted"}`} />
                            {user.isActive ? "Active" : "Suspended"}
                          </button>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Credit</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-text-main">{formatCredit(user.creditCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Requests · {periodLabel}</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-text-main">
                          {NUMBER_FORMAT.format(user.requestsInPeriod || 0)}
                          <span className="ml-1 text-[11px] text-text-muted">{COST_FORMAT.format(user.costInPeriod || 0)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">API keys</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-text-main">
                          {user.apiKeyCount ? `${user.activeApiKeyCount}/${user.apiKeyCount}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Last active</dt>
                        <dd className="mt-0.5 text-sm text-text-main">{user.lastUsedAt ? getRelativeTime(user.lastUsedAt) : "Never"}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => { if (!creating) setCreateOpen(false); }}
        title="New account"
        size="sm"
        footer={
          <>
            <Button variant="ghost" disabled={creating} onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={createAccount}>Create account</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Username"
            value={draft.username}
            onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
            hint="3–32 characters: letters, numbers, dots, underscores, hyphens."
            autoFocus
            required
          />
          <Input
            label="Email"
            type="email"
            value={draft.email}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            required
          />
          <Input
            label="Password"
            value={draft.password}
            onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
            hint="6–128 characters. Share it with the account owner securely."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">Role</span>
              <select
                value={draft.role}
                onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                className="h-9 rounded-sm border border-border bg-surface px-3 font-mono text-sm text-text-main focus-visible:border-primary focus-visible:outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Input
              label="Starting credit"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              icon="attach_money"
              placeholder="0.00"
              value={draft.credit}
              onChange={(event) => setDraft((current) => ({ ...current, credit: event.target.value }))}
            />
          </div>
          {createError && (
            <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{createError}</div>
          )}
        </div>
      </Modal>

      {creditTarget && (
        <CreditAdjustModal
          user={creditTarget}
          onClose={() => setCreditTarget(null)}
          onUpdated={replaceUser}
        />
      )}

      {resetTarget && (
        <PasswordResetModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onUpdated={replaceUser}
        />
      )}

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
