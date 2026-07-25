"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import StatTile from "@/shared/components/StatTile";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };
const EMPTY_PROFILE = { username: "", email: "", currentPassword: "" };
const TABS = [
  { id: "profile", label: "Profile", icon: "person" },
  { id: "wallet", label: "Wallet", icon: "account_balance_wallet" },
  { id: "security", label: "Security", icon: "lock" },
];

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const COST_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMAT.format(date);
}

function formatSignedCents(cents) {
  const amount = CREDIT_FORMAT.format(Math.abs(cents || 0) / 100);
  if ((cents || 0) > 0) return `+${amount}`;
  if ((cents || 0) < 0) return `-${amount}`;
  return amount;
}

function ledgerLabel(entry) {
  if (entry?.note) return entry.note;
  switch (entry?.type) {
    case "signup_bonus":
      return "Signup credit";
    case "usage":
      return "API usage charge";
    case "topup":
      return "Top-up";
    case "deduction":
      return "Deduction";
    case "set_balance":
      return "Balance set";
    default:
      return entry?.type || "Adjustment";
  }
}

function StatusMessage({ status }) {
  if (!status) return null;
  return (
    <div
      role={status.type === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 border px-3 py-2.5 text-sm ${
        status.type === "success"
          ? "border-success/25 bg-success/10 text-success"
          : "border-danger/25 bg-danger/10 text-danger"
      }`}
    >
      <span className="material-symbols-outlined mt-px text-[17px]">
        {status.type === "success" ? "check_circle" : "error"}
      </span>
      <span>{status.message}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-label="Loading account">
      <div className="h-28 animate-pulse bg-surface-2" />
      <div className="h-12 animate-pulse bg-surface-2" />
      <div className="h-80 animate-pulse bg-surface-2" />
    </div>
  );
}

function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") || "profile";
  const activeTab = TABS.some((tab) => tab.id === tabParam) ? tabParam : "profile";

  const [account, setAccount] = useState(null);
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [wallet, setWallet] = useState({ balanceCents: 0, entries: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const setTab = (nextTab) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextTab === "profile") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `/dashboard/account?${query}` : "/dashboard/account");
  };

  const loadWallet = useCallback(async (signal) => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/account/wallet?limit=50", { cache: "no-store", signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load wallet");
      setWallet({
        balanceCents: data.balanceCents || 0,
        entries: Array.isArray(data.entries) ? data.entries : [],
        total: data.total || 0,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        setWallet((current) => ({ ...current, entries: current.entries || [] }));
      }
    } finally {
      if (!signal?.aborted) setWalletLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async (signal) => {
    setLoading(true);
    setLoadError("");
    try {
      const authResponse = await fetch("/api/auth/status", { cache: "no-store", signal });
      const auth = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok || !auth.authenticated) {
        throw new Error(auth.error || "Unable to load your account");
      }

      setAccount(auth);
      if (auth.user) {
        setProfile({
          username: auth.user.username || "",
          email: auth.user.email || "",
          currentPassword: "",
        });

        const [keysResult, usageResult, walletResult] = await Promise.allSettled([
          fetch("/api/keys", { cache: "no-store", signal }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Unable to load API keys");
            return Array.isArray(data.keys) ? data.keys : [];
          }),
          fetch("/api/usage/stats?period=30d&apiKeyId=all", { cache: "no-store", signal }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Unable to load usage");
            return data;
          }),
          fetch("/api/account/wallet?limit=50", { cache: "no-store", signal }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Unable to load wallet");
            return data;
          }),
        ]);
        setKeys(keysResult.status === "fulfilled" ? keysResult.value : []);
        setUsage(usageResult.status === "fulfilled" ? usageResult.value : null);
        if (walletResult.status === "fulfilled") {
          setWallet({
            balanceCents: walletResult.value.balanceCents || 0,
            entries: Array.isArray(walletResult.value.entries) ? walletResult.value.entries : [],
            total: walletResult.value.total || 0,
          });
        }
      } else {
        setProfile(EMPTY_PROFILE);
        setKeys([]);
        setUsage(null);
        setWallet({ balanceCents: 0, entries: [], total: 0 });
      }
    } catch (error) {
      if (error?.name !== "AbortError") setLoadError(error.message || "Unable to load your account");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadProfile(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab !== "wallet") return undefined;
    const controller = new AbortController();
    loadWallet(controller.signal);
    return () => controller.abort();
  }, [activeTab, loadWallet]);

  const identity = account?.user;
  const isOidc = account?.oidcLogin === true;
  const displayName = isOidc
    ? account?.oidcName || account?.oidcEmail || identity?.username || "Account"
    : identity?.username || account?.displayName || "Account";
  const displayEmail = isOidc
    ? account?.oidcEmail || identity?.email || "No email address"
    : identity?.email || "No email address";
  const activeKeys = keys.filter((key) => key.isActive !== false).length;
  const totalTokens = (usage?.totalPromptTokens || 0) + (usage?.totalCompletionTokens || 0);
  const balanceCents = wallet.balanceCents ?? identity?.creditCents ?? 0;
  const profileDirty = Boolean(identity)
    && (profile.username !== identity.username || profile.email !== identity.email);


  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileStatus(null);
    if (!profileDirty) {
      setProfileStatus({ type: "error", message: "Change your username or email before saving." });
      return;
    }
    if (!profile.currentPassword) {
      setProfileStatus({ type: "error", message: "Enter your current password to save identity changes." });
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update profile");
      setAccount((current) => ({ ...current, displayName: data.user.username, user: data.user }));
      setProfile({ username: data.user.username, email: data.user.email, currentPassword: "" });
      setProfileStatus({ type: "success", message: "Profile updated." });
      window.dispatchEvent(new CustomEvent("account-profile-updated"));
    } catch (error) {
      setProfileStatus({ type: "error", message: error.message });
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordStatus(null);
    if (passwords.next.length < 8) {
      setPasswordStatus({ type: "error", message: "Use at least 8 characters for your new password." });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update password");
      setPasswords(EMPTY_PASSWORDS);
      setPasswordStatus({ type: "success", message: "Password updated." });
    } catch (error) {
      setPasswordStatus({ type: "error", message: error.message });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) return <ProfileSkeleton />;

  if (loadError || !account) {
    return (
      <div className="mx-auto flex min-h-72 w-full max-w-xl flex-col items-center justify-center border border-border bg-surface px-6 text-center">
        <span className="material-symbols-outlined text-3xl text-danger">account_circle_off</span>
        <h2 className="mt-3 font-mono text-base font-semibold text-text-main">Account unavailable</h2>
        <p className="mt-1 max-w-md text-sm text-text-muted">{loadError || "Your account could not be loaded."}</p>
        <Button className="mt-5" variant="outline" onClick={() => loadProfile()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
      <section className="overflow-hidden border border-border bg-surface">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-base font-semibold text-text-main">
              {String(displayName).trim().charAt(0).toUpperCase() || "A"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-mono text-xl font-semibold tracking-[-0.03em] text-text-main">{displayName}</h1>
                <Badge variant={identity?.role === "admin" ? "primary" : "neutral"}>
                  {identity?.role || account.role || "user"}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-text-muted">{displayEmail}</p>
            </div>
          </div>
          <div className="tile-grid grid-cols-1 shrink-0 sm:w-60">
            <StatTile chip="cost" label="Available balance" value={CREDIT_FORMAT.format(balanceCents / 100)} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-1 rounded-sm border border-border bg-surface p-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-sm px-3 font-mono text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <Card padding="lg" className="min-w-0">
            <h2 className="font-mono text-base font-semibold text-text-main">Identity</h2>
            <p className="mt-1 text-sm text-text-muted">Update the username and email on this account.</p>
            {isOidc ? (
              <div className="mt-5 border border-border bg-bg-alt/60 px-4 py-3 text-sm text-text-muted">
                This session is managed by your identity provider. Profile fields are read-only here.
              </div>
            ) : (
              <form onSubmit={submitProfile} className="mt-5 space-y-4">
                <Input
                  label="Username"
                  value={profile.username}
                  onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                  required
                />
                <Input
                  label="Current password"
                  type="password"
                  value={profile.currentPassword}
                  onChange={(event) => setProfile((current) => ({ ...current, currentPassword: event.target.value }))}
                  hint="Required to confirm identity changes."
                />
                <StatusMessage status={profileStatus} />
                <Button type="submit" loading={profileSaving} disabled={!profileDirty}>
                  Save profile
                </Button>
              </form>
            )}
          </Card>

          <div className="space-y-4">
            <div className="tile-grid grid-cols-1">
              <StatTile chip="info" label="Active API keys" value={String(activeKeys)} sub={`${keys.length} total keys`} />
              <StatTile chip="tokens" label="Tokens · 30d" value={COMPACT_FORMAT.format(totalTokens)} sub="Prompt + completion" />
              <StatTile chip="cost" label="Usage cost · 30d" value={COST_FORMAT.format(usage?.totalCost || 0)} sub="Estimated routing cost" />
            </div>
            <Card padding="md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-text-main">Wallet snapshot</p>
                  <p className="mt-1 text-xs text-text-muted">Open the wallet tab for full credit history.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTab("wallet")}>Open wallet</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "wallet" && (
        <div className="space-y-5">
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div>
                <h2 className="font-mono text-sm font-semibold text-text-main">Wallet history</h2>
                <p className="text-xs text-text-muted">
                  Top-ups, admin adjustments, and signup bonuses. LLM usage is tracked under Usage, not here.
                </p>
              </div>
              <Button size="sm" variant="ghost" icon="refresh" loading={walletLoading} onClick={() => loadWallet()}>
                Refresh
              </Button>
            </div>

            {walletLoading && wallet.entries.length === 0 ? (
              <div className="h-48 animate-pulse bg-surface-2" />
            ) : wallet.entries.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <span className="material-symbols-outlined text-3xl text-text-subtle">receipt_long</span>
                <p className="mt-2 text-sm font-medium text-text-main">No wallet activity yet</p>
                <p className="mt-1 text-xs text-text-muted">
                  Admin top-ups, deductions, and signup credits will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border-subtle bg-bg-alt/70 font-mono text-[11px] uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">When</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Details</th>
                      <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                      <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {wallet.entries.map((entry) => {
                      const positive = (entry.amountCents || 0) > 0;
                      const negative = (entry.amountCents || 0) < 0;
                      return (
                        <tr key={entry.id} className="hover:bg-bg-alt/50">
                          <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                              positive
                                ? "bg-success/10 text-success"
                                : negative
                                  ? "bg-danger/10 text-danger"
                                  : "bg-surface-2 text-text-muted"
                            }`}>
                              {entry.type || "adjustment"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-text-main">{ledgerLabel(entry)}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
                              {[entry.source, entry.meta?.model, entry.meta?.provider].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums ${
                            positive ? "text-success" : negative ? "text-danger" : "text-text-main"
                          }`}>
                            {formatSignedCents(entry.amountCents)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-text-main">
                            {CREDIT_FORMAT.format((entry.balanceAfterCents || 0) / 100)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "security" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card padding="lg">
            <h2 className="font-mono text-base font-semibold text-text-main">Password</h2>
            <p className="mt-1 text-sm text-text-muted">Change the password used for dashboard sign-in.</p>
            {isOidc ? (
              <div className="mt-5 border border-border bg-bg-alt/60 px-4 py-3 text-sm text-text-muted">
                Password changes are managed by your OIDC provider.
              </div>
            ) : (
              <form onSubmit={submitPassword} className="mt-5 space-y-4">
                <Input
                  label="Current password"
                  type="password"
                  value={passwords.current}
                  onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))}
                  required
                />
                <Input
                  label="New password"
                  type="password"
                  value={passwords.next}
                  onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))}
                  required
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))}
                  required
                />
                <StatusMessage status={passwordStatus} />
                <Button type="submit" loading={passwordSaving}>Update password</Button>
              </form>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="font-mono text-base font-semibold text-text-main">Quick links</h2>
            <div className="mt-4 space-y-2">
              <Link href="/dashboard/api-keys" className="flex items-center gap-2 rounded-sm border border-border px-3 py-2.5 text-sm text-text-main hover:bg-surface-2">
                <span className="material-symbols-outlined text-[18px] text-text-muted">vpn_key</span>
                Manage API keys
              </Link>
              <Link href="/dashboard/usage" className="flex items-center gap-2 rounded-sm border border-border px-3 py-2.5 text-sm text-text-main hover:bg-surface-2">
                <span className="material-symbols-outlined text-[18px] text-text-muted">bar_chart</span>
                View usage
              </Link>
              <button
                type="button"
                onClick={() => copy(displayEmail, "email")}
                className="flex w-full items-center gap-2 rounded-sm border border-border px-3 py-2.5 text-left text-sm text-text-main hover:bg-surface-2"
              >
                <span className="material-symbols-outlined text-[18px] text-text-muted">
                  {copied === "email" ? "check" : "mail"}
                </span>
                Copy account email
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


export default function AccountPageSuspense() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <AccountPage />
    </Suspense>
  );
}
