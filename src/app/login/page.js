"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/shared/components";

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [resetHint, setResetHint] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState("password");
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [oidcLoginLabel, setOidcLoginLabel] = useState("Sign in with OIDC");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = window.setInterval(() => setRetryAfter((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [retryAfter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    if (requestedMode === "register") setMode("register");

    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        window.clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Status unavailable");
        const data = await response.json();
        if (data.requireLogin === false || data.authenticated === true) {
          window.location.assign("/dashboard");
          return;
        }
        setAuthMode(data.authMode || "password");
        setOidcConfigured(data.oidcConfigured === true);
        setOidcLoginLabel(data.oidcLoginLabel || "Sign in with OIDC");
        setRegistrationEnabled(data.registrationEnabled !== false);
        setReady(true);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        setReady(true);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const clearFeedback = () => {
    setError("");
    setResetHint("");
  };

  const switchMode = (nextMode) => {
    clearFeedback();
    setMode(nextMode);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    clearFeedback();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        if (data.resetHint) setResetHint(data.resetHint);
        if (data.retryAfter) setRetryAfter(Number(data.retryAfter));
        return;
      }
      if (data.mustChangePassword) {
        setMustChange(true);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Unable to reach Router2k. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to create account.");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Unable to reach Router2k. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to update password.");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Unable to reach Router2k. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const oidcAvailable = oidcConfigured && ["oidc", "both"].includes(authMode);
  const accountAvailable = authMode !== "oidc" || !oidcConfigured;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-brand-500" aria-label="Loading" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg p-4 sm:p-6 lg:flex lg:items-center lg:justify-center">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[20px] border border-border-subtle bg-surface shadow-[var(--shadow-elev)] lg:min-h-[680px] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#28221f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 size-72 rounded-full border-[48px] border-brand-500/20" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[12px] bg-brand-500 text-white">
                <span className="material-symbols-outlined text-[24px]">hub</span>
              </span>
              <div>
                <p className="text-lg font-semibold">Router2k</p>
                <p className="text-xs text-white/55">AI infrastructure gateway</p>
              </div>
            </div>
          </div>

          <div className="relative max-w-sm">
            <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em]">One gateway. Individual access.</h1>
            <p className="mt-4 text-sm leading-6 text-white/65">
              Every operator signs in with a personal account. Admin and user roles keep identity explicit without changing your routing workflow.
            </p>
            <div className="mt-8 space-y-3 text-sm text-white/75">
              <div className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-brand-400" />Account-based sessions</div>
              <div className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-brand-400" />Admin and user roles</div>
              <div className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-brand-400" />Local recovery for the admin account</div>
            </div>
          </div>

          <p className="relative text-xs text-white/40">Credentials stay on this Router2k instance.</p>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-[11px] bg-brand-500 text-white">
                  <span className="material-symbols-outlined text-[22px]">hub</span>
                </span>
                <div>
                  <p className="font-semibold text-text-main">Router2k</p>
                  <p className="text-xs text-text-muted">AI infrastructure gateway</p>
                </div>
              </div>
            </div>

            {mustChange ? (
              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.025em] text-text-main">Secure the admin account</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">Choose a new password before using this account remotely.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm font-medium text-text-main">New password</label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required autoFocus />
                </div>
                {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                <Button type="submit" variant="primary" className="w-full" loading={loading}>Update password</Button>
              </form>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.025em] text-text-main">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-2 text-sm text-text-muted">
                    {mode === "login" ? "Sign in with your username or email." : "New accounts are created with the user role."}
                  </p>
                </div>

                {accountAvailable && registrationEnabled && (
                  <div className="mt-7 grid grid-cols-2 rounded-[10px] border border-border bg-bg-alt p-1">
                    <button type="button" onClick={() => switchMode("login")} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-surface text-text-main shadow-sm" : "text-text-muted hover:text-text-main"}`}>Sign in</button>
                    <button type="button" onClick={() => switchMode("register")} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "register" ? "bg-surface text-text-main shadow-sm" : "text-text-muted hover:text-text-main"}`}>Register</button>
                  </div>
                )}

                {mode === "register" && accountAvailable && registrationEnabled ? (
                  <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="register-username" className="text-sm font-medium text-text-main">Username</label>
                      <Input id="register-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your.username" minLength={3} maxLength={32} autoComplete="username" required autoFocus />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="register-email" className="text-sm font-medium text-text-main">Email</label>
                      <Input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} autoComplete="email" required />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="register-password" className="text-sm font-medium text-text-main">Password</label>
                        <Input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="confirm-password" className="text-sm font-medium text-text-main">Confirm</label>
                        <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required />
                      </div>
                    </div>
                    {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                    <Button type="submit" variant="primary" className="w-full" loading={loading}>Create user account</Button>
                  </form>
                ) : (
                  <div className="mt-6 space-y-5">
                    {oidcAvailable && (
                      <Button type="button" variant="primary" className="w-full" onClick={() => { window.location.href = "/api/auth/oidc/start"; }}>
                        {oidcLoginLabel}
                      </Button>
                    )}
                    {oidcAvailable && accountAvailable && (
                      <div className="flex items-center gap-3 text-xs text-text-subtle"><span className="h-px flex-1 bg-border" />or use an account<span className="h-px flex-1 bg-border" /></div>
                    )}
                    {accountAvailable && (
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="login-username" className="text-sm font-medium text-text-main">Username or email</label>
                          <Input id="login-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" autoComplete="username" required autoFocus={!oidcAvailable} />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="login-password" className="text-sm font-medium text-text-main">Password</label>
                          <Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                        </div>
                        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                        {retryAfter > 0 && <p className="text-sm text-warning">Locked. Retry in <span className="font-mono">{retryAfter}s</span>.</p>}
                        {resetHint && <p className="text-xs leading-5 text-text-muted">Reset the admin account from the local Router2k CLI (<code className="rounded bg-surface-2 px-1.5 py-0.5">9router</code>) → Settings → Reset Admin Account.</p>}
                        <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={retryAfter > 0}>
                          {retryAfter > 0 ? `Wait ${retryAfter}s` : "Sign in"}
                        </Button>
                      </form>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
