"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "#models", label: "Models" },
  { href: "#integrations", label: "Integrations" },
  { href: "#how-it-works", label: "Routing" },
  { href: "#features", label: "Governance" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [auth, setAuth] = useState({ loading: true, authenticated: false, displayName: "" });
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("status unavailable");
        const data = await response.json();
        setAuth({
          loading: false,
          authenticated: data.authenticated === true,
          displayName: data.displayName || data.user?.username || "",
        });
      })
      .catch(() => setAuth({ loading: false, authenticated: false, displayName: "" }));
    return () => controller.abort();
  }, []);

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex h-8 items-center justify-center gap-2 bg-zinc-950 px-4 text-center text-xs font-medium text-white">
        <span className="text-blue-300">⚡</span>
        <span className="truncate">Router2k routes every prompt intelligently — higher availability, stronger guardrails, lower spend.</span>
        <a className="hidden text-blue-300 hover:text-blue-200 sm:inline" href="#models">Browse models ↗</a>
      </div>
      <nav className="border-b border-blue-100/80 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0"
            onClick={() => router.push("/")}
            aria-label="Navigate to home"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm shadow-blue-950/20">
              <span className="material-symbols-outlined text-[20px]">route</span>
            </div>
            <span className="text-lg font-black tracking-[-0.02em] text-zinc-950">Router2k</span>
          </button>

          <div className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} className="text-sm font-semibold text-zinc-600 transition-colors hover:text-blue-700" href={item.href}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!auth.loading && auth.authenticated ? (
              <>
                <span className="hidden max-w-[140px] truncate text-sm text-zinc-500 lg:inline">
                  {auth.displayName || "Signed in"}
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-800 shadow-sm transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/login?mode=register"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Get API key
                </Link>
              </>
            )}
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-950 lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-blue-100 bg-white/96 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6">
              {NAV_ITEMS.map((item) => (
                <a key={item.href} className="text-sm font-bold text-zinc-700 transition-colors hover:text-blue-700" href={item.href} onClick={closeMobile}>
                  {item.label}
                </a>
              ))}
              {!auth.loading && auth.authenticated ? (
                <Link href="/dashboard" onClick={closeMobile} className="h-10 rounded-xl bg-zinc-950 text-center text-sm font-bold leading-10 text-white">
                  Open dashboard
                </Link>
              ) : (
                <Link href="/login" onClick={closeMobile} className="h-10 rounded-xl border border-zinc-200 text-center text-sm font-bold leading-10 text-zinc-950">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
