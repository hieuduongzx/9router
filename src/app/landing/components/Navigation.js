"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/models", label: "Models" },
  { href: "/dashboard/endpoint", label: "API endpoint" },
];

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [auth, setAuth] = useState({ loading: true, authenticated: false, displayName: "" });

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <nav aria-label="Primary navigation">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
            aria-label="Router2k home"
          >
            <span className="flex size-8 items-center justify-center border border-zinc-950 bg-zinc-950 text-white">
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">route</span>
            </span>
            <span className="font-mono text-sm font-semibold tracking-tight text-zinc-950">Router2k</span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                className="font-mono text-[13px] font-medium text-zinc-600 transition-colors hover:text-zinc-950"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {auth.loading ? (
              <div className="hidden h-9 w-[150px] sm:block" aria-hidden="true" />
            ) : auth.authenticated ? (
              <>
                <span className="hidden max-w-[140px] truncate font-mono text-[13px] text-zinc-500 xl:inline">
                  {auth.displayName || "Signed in"}
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-sm bg-zinc-950 px-4 font-mono text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden h-9 items-center justify-center rounded-sm px-3 font-mono text-[13px] font-semibold text-zinc-700 transition-colors hover:text-zinc-950 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/login?mode=register"
                  className="inline-flex h-9 items-center justify-center rounded-sm bg-zinc-950 px-4 font-mono text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Get API key
                </Link>
              </>
            )}
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-sm border border-zinc-200 bg-white text-zinc-950 transition-colors hover:border-zinc-400 lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{mobileMenuOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-zinc-200 bg-white lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  className="flex min-h-10 items-center rounded-sm px-3 font-mono text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                  href={item.href}
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              ))}
              {!auth.loading && !auth.authenticated && (
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="mt-2 flex min-h-10 items-center justify-center rounded-sm border border-zinc-200 font-mono text-sm font-semibold text-zinc-950 sm:hidden"
                >
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
