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
  StatTile,
  UsageFilterBar,
  useUsageFacets,
  usageFiltersToParams,
  describeUsageWindow,
} from "@/shared/components";
import { getRelativeTime } from "@/shared/utils";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useShellPath } from "@/shared/hooks/useShellPath";
import ActionMenu from "./components/ActionMenu";
import CreditAdjustModal from "./components/CreditAdjustModal";
import PasswordResetModal from "./components/PasswordResetModal";
import {
  COST_FORMAT,
  NUMBER_FORMAT,
  formatCredit,
  formatDate,
  formatDateTime,
  initials,
} from "./components/userFormat";
import { Icon } from "@/shared/components/ui/icon";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "credit", label: "Highest credit" },
  { value: "lowCredit", label: "Lowest credit" },
  { value: "requests", label: "Most requests" },
  { value: "spend", label: "Highest spend" },
  { value: "tokens", label: "Most tokens" },
  { value: "active", label: "Recently active" },
];

/** A balance under this is flagged as low (cents). */
const LOW_CREDIT_CENTS = 100;

/**
 * Low credit only matters for accounts the billing gate charges: administrators
 * are allowed through at a zero balance, so flagging them would be noise.
 */
function isLowCredit(user) {
  return user.isActive && user.role !== "admin" && (user.creditCents || 0) < LOW_CREDIT_CENTS;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadAccountsCsv(users, windowLabel) {
  const header = ["username", "email", "role", "status", "credit_usd", "api_keys", `requests (${windowLabel})`, `spend_usd (${windowLabel})`, `tokens (${windowLabel})`, "top_model", "last_active", "joined"];
  const rows = users.map((user) => [
    user.username,
    user.email,
    user.role,
    user.isActive ? "active" : "suspended",
    ((user.creditCents || 0) / 100).toFixed(2),
    user.apiKeyCount || 0,
    user.requestsInPeriod || 0,
    (user.costInPeriod || 0).toFixed(4),
    user.tokensInPeriod || 0,
    user.topModel || "",
    user.lastUsedAt || "",
    user.createdAt || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Accounts are long-lived, so a month of history is the useful default here. */
const DEFAULT_PERIOD = "30d";
const EMPTY_DRAFT = { username: "", email: "", password: "", role: "user", credit: "" };
const FILTER_SELECT_CLASS = "h-7 rounded-sm border border-border bg-background px-2.5 font-sans text-[13px] font-medium leading-4 text-foreground focus-visible:border-primary focus-visible:outline-none";

export default function UsersPageClient() {
  const router = useRouter();
  const shellPath = useShellPath();
  const usersHref = shellPath("/dashboard/users");
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [unassignedKeyCount, setUnassignedKeyCount] = useState(0);
  // Usage window + model/provider scope for the activity columns (server-side).
  const [usageFilters, setUsageFilters] = useState({ period: DEFAULT_PERIOD, startDate: "", endDate: "", model: "", provider: "", status: "", userId: "" });
  const facets = useUsageFacets({ scope: "system" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [creditFilter, setCreditFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const usageQuery = new URLSearchParams(usageFiltersToParams(usageFilters)).toString();

  const loadUsers = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/users?${usageQuery}`, { cache: "no-store" });
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
  }, [usageQuery]);

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

  /** Change several accounts' access at once; the signed-in admin is never touched. */
  const bulkSetActive = async (isActive) => {
    const targets = users.filter((user) => selectedIds.has(user.id) && user.id !== currentUserId && user.isActive !== isActive);
    if (targets.length === 0) return;
    setBulkBusy(true);
    setError("");
    const failures = [];
    for (const user of targets) {
      try {
        const response = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "update failed");
        replaceUser(data.user);
      } catch (bulkError) {
        failures.push(`${user.username}: ${bulkError.message}`);
      }
    }
    if (failures.length) setError(`Some accounts were not updated — ${failures.join("; ")}`);
    setBulkBusy(false);
  };

  const scopedToModel = Boolean(usageFilters.model || usageFilters.provider);
  const windowLabel = describeUsageWindow(usageFilters);

  const totals = useMemo(() => ({
    active: users.filter((user) => user.isActive).length,
    suspended: users.filter((user) => !user.isActive).length,
    admins: users.filter((user) => user.role === "admin" && user.isActive).length,
    creditCents: users.reduce((sum, user) => sum + (user.creditCents || 0), 0),
    lowCredit: users.filter(isLowCredit).length,
    requests: users.reduce((sum, user) => sum + (user.requestsInPeriod || 0), 0),
    cost: users.reduce((sum, user) => sum + (user.costInPeriod || 0), 0),
    usedInWindow: users.filter((user) => (user.requestsInPeriod || 0) > 0).length,
    keys: users.reduce((sum, user) => sum + (user.apiKeyCount || 0), 0),
  }), [users]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "suspended" && user.isActive) return false;
      if (activityFilter === "used" && !(user.requestsInPeriod > 0)) return false;
      if (activityFilter === "idle" && user.requestsInPeriod > 0) return false;
      if (creditFilter === "low" && !isLowCredit(user)) return false;
      if (creditFilter === "empty" && (user.creditCents || 0) > 0) return false;
      if (!query) return true;
      return [user.username, user.email, user.id].some((field) => String(field || "").toLowerCase().includes(query));
    });

    const byTime = (value) => (value ? new Date(value).getTime() : 0);
    const sorters = {
      recent: (a, b) => byTime(b.createdAt) - byTime(a.createdAt),
      oldest: (a, b) => byTime(a.createdAt) - byTime(b.createdAt),
      name: (a, b) => String(a.username || "").localeCompare(String(b.username || "")),
      credit: (a, b) => (b.creditCents || 0) - (a.creditCents || 0),
      lowCredit: (a, b) => (a.creditCents || 0) - (b.creditCents || 0),
      requests: (a, b) => (b.requestsInPeriod || 0) - (a.requestsInPeriod || 0),
      spend: (a, b) => (b.costInPeriod || 0) - (a.costInPeriod || 0),
      tokens: (a, b) => (b.tokensInPeriod || 0) - (a.tokensInPeriod || 0),
      active: (a, b) => byTime(b.lastUsedAt) - byTime(a.lastUsedAt),
    };
    return filtered.sort(sorters[sort] || sorters.recent);
  }, [users, search, roleFilter, statusFilter, activityFilter, creditFilter, sort]);

  const filtersActive = Boolean(search.trim()) || roleFilter !== "all" || statusFilter !== "all" || activityFilter !== "all" || creditFilter !== "all";
  const periodLabel = windowLabel;
  // Bars are relative to the busiest visible account, so the column reads as a ranking.
  const maxCost = visibleUsers.reduce((max, user) => Math.max(max, user.costInPeriod || 0), 0);
  const maxRequests = visibleUsers.reduce((max, user) => Math.max(max, user.requestsInPeriod || 0), 0);
  const selectedVisible = visibleUsers.filter((user) => selectedIds.has(user.id));
  const allVisibleSelected = visibleUsers.length > 0 && selectedVisible.length === visibleUsers.length;
  const toggleSelected = (userId) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleUsers.map((user) => user.id)));
  const clearListFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setActivityFilter("all");
    setCreditFilter("all");
  };
  const requestsHref = (userId) => `${shellPath("/dashboard/activity")}?tab=requests&userId=${encodeURIComponent(userId)}${usageFilters.model ? `&model=${encodeURIComponent(usageFilters.model)}` : ""}`;

  const buildMenu = (user) => {
    const isCurrent = user.id === currentUserId;
    return [
      { label: "View details", icon: "open_in_new", onSelect: () => router.push(`${usersHref}/${user.id}`) },
      { label: "View requests", icon: "receipt_long", onSelect: () => router.push(requestsHref(user.id)) },
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
    <div className="flex min-w-0 flex-col gap-6">
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
          sub={totals.lowCredit ? `${totals.lowCredit} active account${totals.lowCredit === 1 ? "" : "s"} under ${formatCredit(LOW_CREDIT_CENTS)}` : "Sum of all account balances"}
        />
        <StatTile
          chip="tokens"
          label={`Requests · ${periodLabel}`}
          value={NUMBER_FORMAT.format(totals.requests)}
          sub={`${COST_FORMAT.format(totals.cost)} spend · ${totals.usedInWindow} account${totals.usedInWindow === 1 ? "" : "s"} active${scopedToModel ? ` · ${usageFilters.model || usageFilters.provider}` : ""}`}
        />
      </div>

      {error && (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Accounts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visibleUsers.length === users.length
                ? `${users.length} account${users.length === 1 ? "" : "s"}`
                : `${visibleUsers.length} of ${users.length} accounts`}
              {" · roles, access, credit, and usage"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-[16px] text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search username, email, ID"
                aria-label="Search accounts"
                className="h-7 w-full rounded-sm border border-border bg-background pl-8 pr-3 font-sans text-[13px] font-medium leading-4 text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
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
            <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)} aria-label="Filter by activity" className={FILTER_SELECT_CLASS}>
              <option value="all">Any activity</option>
              <option value="used">Made requests</option>
              <option value="idle">No requests</option>
            </select>
            <select value={creditFilter} onChange={(event) => setCreditFilter(event.target.value)} aria-label="Filter by credit" className={FILTER_SELECT_CLASS}>
              <option value="all">Any credit</option>
              <option value="low">Low credit (&lt; {formatCredit(LOW_CREDIT_CENTS)})</option>
              <option value="empty">No credit</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort accounts" className={FILTER_SELECT_CLASS}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" icon="refresh" loading={refreshing} onClick={loadUsers}>Refresh</Button>
            <Button variant="ghost" size="sm" icon="download" disabled={visibleUsers.length === 0} onClick={() => downloadAccountsCsv(selectedVisible.length ? selectedVisible : visibleUsers, windowLabel)}>
              {selectedVisible.length ? `Export ${selectedVisible.length}` : "Export"}
            </Button>
            <Button size="sm" icon="person_add" onClick={() => { setDraft(EMPTY_DRAFT); setCreateError(""); setCreateOpen(true); }}>
              New account
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-border bg-surface-2/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-medium text-muted-foreground">Usage columns</span>
            <UsageFilterBar
              value={usageFilters}
              onChange={(next) => {
                // Picking a model is almost always "who uses it": hide accounts that never called it.
                if ((next.model && next.model !== usageFilters.model) || (next.provider && next.provider !== usageFilters.provider)) {
                  if (activityFilter === "all") setActivityFilter("used");
                }
                setUsageFilters(next);
              }}
              facets={facets}
              fields={["period", "model", "provider"]}
              className="min-w-0 flex-1"
            />
          </div>
          {scopedToModel && (
            <p className="text-xs text-muted-foreground">
              Requests, spend, tokens and last active count only <span className="font-mono text-foreground">{usageFilters.model || usageFilters.provider}</span>.
            </p>
          )}
        </div>

        {selectedVisible.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2" role="region" aria-label="Bulk actions">
            <span className="text-sm font-medium text-foreground">{selectedVisible.length} selected</span>
            <Button size="sm" variant="outline" icon="block" loading={bulkBusy} onClick={() => bulkSetActive(false)}>Suspend</Button>
            <Button size="sm" variant="outline" icon="check_circle" loading={bulkBusy} onClick={() => bulkSetActive(true)}>Reactivate</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
            {selectedVisible.some((user) => user.id === currentUserId) && (
              <span className="text-xs text-muted-foreground">Your own account is skipped.</span>
            )}
          </div>
        )}

        {visibleUsers.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Icon name="group_off" className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">
              {filtersActive ? "No accounts match these filters" : "No accounts yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtersActive ? "Clear the search or filters to see every account." : "Create the first account to grant dashboard access."}
            </p>
            {filtersActive && (
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={clearListFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: dense table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1160px] text-left text-sm">
                <thead className="thead-data">
                  <tr>
                    <th scope="col" className="w-10 pl-4 pr-0 py-2.5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label={allVisibleSelected ? "Deselect all accounts" : "Select all visible accounts"}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Credit</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Keys</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Usage · {periodLabel}</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Top model</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Last active</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="tbody-data">
                  {visibleUsers.map((user) => {
                    const isCurrent = user.id === currentUserId;
                    const busy = busyId === user.id;
                    return (
                      <tr key={user.id} className={`${busy ? "opacity-60" : ""} ${selectedIds.has(user.id) ? "bg-primary/5" : ""}`}>
                        <td className="w-10 pl-4 pr-0 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={() => toggleSelected(user.id)}
                            aria-label={`Select ${user.username}`}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-xs font-semibold text-foreground">
                              {initials(user.username)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link href={`${usersHref}/${user.id}`} className="truncate font-mono text-sm font-semibold text-foreground hover:text-primary">
                                  {user.username}
                                </Link>
                                {isCurrent && <Badge size="sm" variant="info">You</Badge>}
                                {user.mustChangePassword && (
                                  <span title="Must choose a new password at next sign-in">
                                    <Badge size="sm" variant="warning">Reset</Badge>
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.role}
                            disabled={busy || isCurrent}
                            aria-label={`Role for ${user.username}`}
                            onChange={(event) => updateUser(user.id, { role: event.target.value })}
                            className="h-7 rounded-sm border border-border bg-background px-2 font-sans text-[13px] font-medium leading-4 text-foreground focus-visible:border-primary focus-visible:outline-none disabled:opacity-60"
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
                            className={`inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[13px] font-medium leading-4 transition-colors disabled:opacity-60 ${
                              user.isActive
                                ? "border-success/25 bg-success/10 text-success"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            <span className={`size-1.5 ${user.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                            {user.isActive ? "Active" : "Suspended"}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setError(""); setCreditTarget(user); }}
                            title="Adjust credit"
                            className={`font-mono text-sm font-semibold tabular-nums underline-offset-4 hover:text-primary hover:underline disabled:opacity-60 ${
                              isLowCredit(user) ? "text-warning" : "text-foreground"
                            }`}
                          >
                            {formatCredit(user.creditCents)}
                          </button>
                          {isLowCredit(user) && (
                            <p className="text-[11px] text-warning">Low</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                          {user.apiKeyCount ? (
                            <span title={`${user.activeApiKeyCount} active of ${user.apiKeyCount}`}>
                              {user.activeApiKeyCount}
                              <span className="text-muted-foreground">/{user.apiKeyCount}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {user.requestsInPeriod ? (
                            <Link href={requestsHref(user.id)} className="group block min-w-[180px]" title="Open this account's requests in Activity">
                              <span className="flex items-baseline justify-between gap-3 font-mono text-xs tabular-nums">
                                <span className="text-foreground group-hover:text-primary">{NUMBER_FORMAT.format(user.requestsInPeriod)} req</span>
                                <span className="font-semibold text-foreground">{COST_FORMAT.format(user.costInPeriod || 0)}</span>
                              </span>
                              <span className="mt-1 block h-1.5 w-full bg-surface-2" aria-hidden="true">
                                <span
                                  className="block h-1.5 bg-primary"
                                  style={{ width: `${Math.max(2, maxCost > 0 ? ((user.costInPeriod || 0) / maxCost) * 100 : ((user.requestsInPeriod || 0) / Math.max(maxRequests, 1)) * 100)}%` }}
                                />
                              </span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">No requests</span>
                          )}
                        </td>
                        <td className="max-w-[220px] px-3 py-3">
                          {user.topModel ? (
                            <>
                              <p className="truncate font-mono text-xs text-foreground" title={user.topModel}>{user.topModel}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {user.requestsInPeriod ? `${Math.round((user.topModelRequests / user.requestsInPeriod) * 100)}% of requests` : ""}
                                {user.modelCount > 1 ? ` · ${user.modelCount} models` : ""}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs text-foreground" title={formatDateTime(user.lastUsedAt)}>
                            {user.lastUsedAt ? getRelativeTime(user.lastUsedAt) : "Never"}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">Joined {formatDate(user.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`${usersHref}/${user.id}`}
                              className="inline-flex h-7 items-center rounded-sm border border-border px-2.5 font-sans text-[13px] font-medium leading-4 text-foreground transition-colors hover:bg-muted"
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
                        <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-sm font-semibold text-foreground">
                          {initials(user.username)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`${usersHref}/${user.id}`} className="truncate font-mono text-sm font-semibold text-foreground">
                              {user.username}
                            </Link>
                            {isCurrent && <Badge size="sm" variant="info">You</Badge>}
                            {user.mustChangePassword && <Badge size="sm" variant="warning">Reset</Badge>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelected(user.id)}
                          aria-label={`Select ${user.username}`}
                          className="size-5 cursor-pointer accent-primary"
                        />
                        <ActionMenu items={buildMenu(user)} label={`Actions for ${user.username}`} />
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Role</dt>
                        <dd className="mt-0.5">
                          <select
                            value={user.role}
                            disabled={busy || isCurrent}
                            aria-label={`Role for ${user.username}`}
                            onChange={(event) => updateUser(user.id, { role: event.target.value })}
                            className="h-7 w-full rounded-sm border border-border bg-background px-2.5 font-sans text-[13px] font-medium leading-4 text-foreground disabled:opacity-60"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="mt-0.5">
                          <button
                            type="button"
                            disabled={busy || isCurrent}
                            onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                            className={`inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-sm border text-[13px] font-medium leading-4 transition-colors disabled:opacity-60 ${
                              user.isActive
                                ? "border-success/25 bg-success/10 text-success"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            <span className={`size-1.5 ${user.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                            {user.isActive ? "Active" : "Suspended"}
                          </button>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Credit</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{formatCredit(user.creditCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Requests · {periodLabel}</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                          {NUMBER_FORMAT.format(user.requestsInPeriod || 0)}
                          <span className="ml-1 text-[11px] text-muted-foreground">{COST_FORMAT.format(user.costInPeriod || 0)}</span>
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Top model</dt>
                        <dd className="mt-0.5 truncate font-mono text-xs text-foreground">{user.topModel || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">API keys</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                          {user.apiKeyCount ? `${user.activeApiKeyCount}/${user.apiKeyCount}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last active</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{user.lastUsedAt ? getRelativeTime(user.lastUsedAt) : "Never"}</dd>
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
              <span className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">Role</span>
              <select
                value={draft.role}
                onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                className="h-7 rounded-sm border border-border bg-background px-2.5 font-sans text-[13px] font-medium leading-4 text-foreground focus-visible:border-primary focus-visible:outline-none"
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

