"use client";

import { useEffect, useState } from "react";
import { Button, Input, CropFrame } from "@/shared/components";

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
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-text-main" aria-label="Loading" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg p-4 sm:p-6 lg:flex lg:items-center lg:justify-center">
      <CropFrame className="mx-auto grid w-full max-w-5xl border border-border bg-surface lg:min-h-[680px] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#0a0a0a] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center border border-white/15 text-white">
                <span className="material-symbols-outlined text-[20px]">route</span>
              </span>
              <div>
                <p className="font-mono text-sm font-semibold">Router2k</p>
                <p className="section-label !text-white/40">AI Infrastructure Gateway</p>
              </div>
            </div>
          </div>

          <div className="relative max-w-sm">
            <h1 className="font-mono text-3xl font-semibold leading-tight tracking-tight">One gateway.<br />Individual access.</h1>
            <p className="mt-4 text-sm leading-6 text-white/60">
              Every operator signs in with a personal account. Admin and user roles keep identity explicit without changing your routing workflow.
            </p>
            <div className="mt-8 space-y-2.5 font-mono text-xs text-white/70">
              <div className="flex items-center gap-2.5"><span className="size-1.5 bg-emerald-400" />account-based sessions</div>
              <div className="flex items-center gap-2.5"><span className="size-1.5 bg-emerald-400" />admin and user roles</div>
              <div className="flex items-center gap-2.5"><span className="size-1.5 bg-emerald-400" />local recovery for the admin account</div>
            </div>
          </div>

          <p className="relative font-mono text-[11px] text-white/35">{"// "}credentials stay on this Router2k instance</p>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center border border-border bg-primary text-[hsl(var(--primary-foreground))]">
                  <span className="material-symbols-outlined text-[20px]">route</span>
                </span>
                <div>
                  <p className="font-mono font-semibold text-text-main">Router2k</p>
                  <p className="text-xs text-text-muted">AI infrastructure gateway</p>
                </div>
              </div>
            </div>

            {mustChange ? (
              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <div>
                  <h2 className="font-mono text-xl font-semibold tracking-tight text-text-main">Secure the admin account</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">Choose a new password before using this account remotely.</p>
                </div>
                <Input id="new-password" label="New password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required autoFocus />
                {error && <p className="font-mono text-sm text-danger" role="alert">{error}</p>}
                <Button type="submit" variant="primary" className="w-full" loading={loading}>Update password</Button>
              </form>
            ) : (
              <>
                <div>
                  <h2 className="font-mono text-xl font-semibold tracking-tight text-text-main">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-2 text-sm text-text-muted">
                    {mode === "login" ? "Sign in with your username or email." : "New accounts are created with the user role."}
                  </p>
                </div>

                {accountAvailable && registrationEnabled && (
                  <div className="mt-7 grid grid-cols-2 border border-border p-1">
                    <button type="button" onClick={() => switchMode("login")} className={`rounded-sm px-3 py-2 font-mono text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-[hsl(var(--primary-foreground))]" : "text-text-muted hover:text-text-main"}`}>Sign in</button>
                    <button type="button" onClick={() => switchMode("register")} className={`rounded-sm px-3 py-2 font-mono text-sm font-medium transition-colors ${mode === "register" ? "bg-primary text-[hsl(var(--primary-foreground))]" : "text-text-muted hover:text-text-main"}`}>Register</button>
                  </div>
                )}

                {mode === "register" && accountAvailable && registrationEnabled ? (
                  <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <Input id="register-username" label="Username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your.username" minLength={3} maxLength={32} autoComplete="username" required autoFocus />
                    <Input id="register-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} autoComplete="email" required />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input id="register-password" label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required />
                      <Input id="confirm-password" label="Confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required />
                    </div>
                    {error && <p className="font-mono text-sm text-danger" role="alert">{error}</p>}
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
                      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wide text-text-subtle"><span className="h-px flex-1 bg-border" />or use an account<span className="h-px flex-1 bg-border" /></div>
                    )}
                    {accountAvailable && (
                      <form onSubmit={handleLogin} className="space-y-4">
                        <Input id="login-username" label="Username or email" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" autoComplete="username" required autoFocus={!oidcAvailable} />
                        <Input id="login-password" label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                        {error && <p className="font-mono text-sm text-danger" role="alert">{error}</p>}
                        {retryAfter > 0 && <p className="font-mono text-sm text-warning">Locked. Retry in <span className="font-semibold">{retryAfter}s</span>.</p>}
                        {resetHint && <p className="text-xs leading-5 text-text-muted">Reset the admin account from the local Router2k CLI (<code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono">9router</code>) → Settings → Reset Admin Account.</p>}
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
      </CropFrame>
    </main>
  );
}
