"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };
const EMPTY_PROFILE = { username: "", email: "", currentPassword: "" };
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
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : DATE_FORMAT.format(date);
}

function getInitials(value) {
  const parts = String(value || "Account").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}

function StatusMessage({ status }) {
  if (!status) return null;
  return (
    <div
      role={status.type === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
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

function Metric({ icon, label, value, detail }) {
  return (
    <Card padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-[-0.025em] text-text-main tabular-nums">{value}</p>
          <p className="mt-1 truncate text-[11px] text-text-subtle">{detail}</p>
        </div>
        <span className="material-symbols-outlined text-[20px] text-text-subtle">{icon}</span>
      </div>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-label="Loading profile">
      <div className="h-48 animate-pulse rounded-[16px] bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[14px] bg-surface-2" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <div className="h-96 animate-pulse rounded-[14px] bg-surface-2" />
        <div className="h-80 animate-pulse rounded-[14px] bg-surface-2" />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [account, setAccount] = useState(null);
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();

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

        const [keysResult, usageResult] = await Promise.allSettled([
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
        ]);
        setKeys(keysResult.status === "fulfilled" ? keysResult.value : []);
        setUsage(usageResult.status === "fulfilled" ? usageResult.value : null);
      } else {
        setProfile(EMPTY_PROFILE);
        setKeys([]);
        setUsage(null);
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
      <div className="mx-auto flex min-h-72 w-full max-w-xl flex-col items-center justify-center rounded-[14px] border border-border bg-surface px-6 text-center">
        <span className="material-symbols-outlined text-3xl text-danger">account_circle_off</span>
        <h2 className="mt-3 text-base font-semibold text-text-main">Profile unavailable</h2>
        <p className="mt-1 max-w-md text-sm text-text-muted">{loadError || "Your account could not be loaded."}</p>
        <Button className="mt-5" variant="outline" onClick={() => loadProfile()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
      <section className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="flex min-w-0 flex-col justify-between gap-8 p-5 sm:p-7">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-white shadow-sm">
                {getInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold tracking-[-0.025em] text-text-main">{displayName}</h2>
                  <Badge variant={account.role === "admin" ? "primary" : "default"} size="sm">
                    {account.role || "user"}
                  </Badge>
                  <Badge variant="success" size="sm" dot>Active</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-text-muted">{displayEmail}</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">
                  Manage the identity, balance, and sign-in security attached to your Router2k access.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">key</span>
                {activeKeys} active API key{activeKeys === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                Member since {formatDate(identity?.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between border-t border-border bg-primary/[0.045] p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Available balance</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-text-main tabular-nums">
                  {identity ? CREDIT_FORMAT.format((identity.creditCents || 0) / 100) : "—"}
                </p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-surface text-primary shadow-sm">
                <span className="material-symbols-outlined text-[21px]">account_balance_wallet</span>
              </span>
            </div>
            <div className="mt-8 border-t border-primary/10 pt-4">
              <p className="text-xs leading-5 text-text-muted">
                {identity
                  ? account.role === "admin"
                    ? "Credit currently assigned to this administrator account."
                    : "Your administrator manages this account-level balance."
                  : "Balance is managed by your identity provider."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="30-day account summary">
        <Metric icon="vpn_key" label="API keys" value={COMPACT_FORMAT.format(activeKeys)} detail={`${keys.length} total`} />
        <Metric icon="receipt_long" label="Requests" value={COMPACT_FORMAT.format(usage?.totalRequests || 0)} detail="Last 30 days" />
        <Metric icon="token" label="Tokens" value={COMPACT_FORMAT.format(totalTokens)} detail="Input and output · 30 days" />
        <Metric icon="payments" label="Recorded usage" value={COST_FORMAT.format(usage?.totalCost || 0)} detail="Estimated cost · 30 days" />
      </section>

      {identity?.mustChangePassword && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="material-symbols-outlined text-[20px]">password</span>
          <div>
            <p className="font-semibold">Password update required</p>
            <p className="mt-0.5 text-xs opacity-90">Replace the temporary recovery password before continuing to use this account.</p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-semibold text-text-main">Profile details</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {isOidc ? "Identity fields are managed by your OIDC provider." : "Update how this account signs in and appears across the dashboard."}
              </p>
            </div>
            {isOidc || !identity ? (
              <div className="flex items-start gap-3 px-5 py-5 text-sm text-text-muted">
                <span className="material-symbols-outlined text-[20px] text-primary">domain</span>
                <p>Update your name or email through the connected identity provider. Router2k will use those changes after your next sign-in.</p>
              </div>
            ) : (
              <form onSubmit={submitProfile} className="space-y-4 px-5 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Username"
                    value={profile.username}
                    onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9._-]{3,32}"
                    autoComplete="username"
                    hint="3–32 letters, numbers, dots, underscores, or hyphens."
                    required
                  />
                  <Input
                    label="Email address"
                    type="email"
                    value={profile.email}
                    onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </div>
                <Input
                  label="Current password"
                  type="password"
                  value={profile.currentPassword}
                  onChange={(event) => setProfile((current) => ({ ...current, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                  hint="Required only to authorize username or email changes."
                  required={profileDirty}
                />
                <StatusMessage status={profileStatus} />
                <div className="flex justify-end">
                  <Button type="submit" loading={profileSaving} disabled={!profileDirty}>Save profile</Button>
                </div>
              </form>
            )}
          </Card>

          {!isOidc && identity && (
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-border-subtle px-5 py-4">
                <h2 className="text-sm font-semibold text-text-main">Password</h2>
                <p className="mt-0.5 text-xs text-text-muted">Use at least 8 characters and avoid passwords used on other services.</p>
              </div>
              <form onSubmit={submitPassword} className="space-y-4 px-5 py-5">
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={passwords.next}
                    onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))}
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={passwords.confirm}
                    onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))}
                    required
                  />
                </div>
                <StatusMessage status={passwordStatus} />
                <div className="flex justify-end">
                  <Button type="submit" loading={passwordSaving}>Update password</Button>
                </div>
              </form>
            </Card>
          )}

          {isOidc && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
              <span className="material-symbols-outlined text-[20px] text-primary">verified_user</span>
              <p>Password and multi-factor authentication are managed by your OIDC identity provider.</p>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-semibold text-text-main">Account details</h2>
              <p className="mt-0.5 text-xs text-text-muted">Access and lifecycle information.</p>
            </div>
            <dl className="divide-y divide-border-subtle">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-xs text-text-muted">Role</dt>
                <dd className="text-xs font-semibold capitalize text-text-main">{account.role || "user"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-xs text-text-muted">Access</dt>
                <dd className="text-right text-xs font-medium text-text-main">
                  {account.role === "admin" ? "System administration" : "Own keys and usage"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-xs text-text-muted">Sign-in</dt>
                <dd className="text-xs font-medium text-text-main">{account.loginMethod || "Account"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-xs text-text-muted">Last profile change</dt>
                <dd className="text-xs font-medium text-text-main">{formatDate(identity?.updatedAt)}</dd>
              </div>
              {identity?.id && (
                <div className="px-5 py-3.5">
                  <dt className="text-xs text-text-muted">Account ID</dt>
                  <dd className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-bg-alt px-2 py-1.5 text-[11px] text-text-main" title={identity.id}>{identity.id}</code>
                    <button
                      type="button"
                      onClick={() => copy(identity.id, "account-id")}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label="Copy account ID"
                      title="Copy account ID"
                    >
                      <span className="material-symbols-outlined text-[17px]">{copied === "account-id" ? "check" : "content_copy"}</span>
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-semibold text-text-main">Your workspace</h2>
              <p className="mt-0.5 text-xs text-text-muted">Manage the resources attached to this identity.</p>
            </div>
            <div className="divide-y divide-border-subtle">
              <Link href="/dashboard/api-keys" className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">API keys</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Create, pause, and track credentials</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle transition-transform group-hover:translate-x-0.5">chevron_right</span>
              </Link>
              <Link href="/dashboard/usage" className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
                  <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Usage</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Inspect requests, tokens, and cost</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle transition-transform group-hover:translate-x-0.5">chevron_right</span>
              </Link>
              <Link href="/dashboard/models" className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <span className="material-symbols-outlined text-[18px]">deployed_code</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Models</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">View models available to your keys</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle transition-transform group-hover:translate-x-0.5">chevron_right</span>
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
