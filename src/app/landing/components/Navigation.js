"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

const PRIMARY_NAV = [
  { href: "/#overview", label: "Overview" },
  { href: "/#endpoint", label: "Endpoint" },
  { href: "/#models", label: "Models" },
  { href: "/ranking", label: "Ranking" },
];

const DEVELOPER_LINKS = [
  { href: "/#overview", label: "Overview" },
  { href: "/#endpoint", label: "Endpoint" },
  { href: "/#models", label: "Models" },
  { href: "/ranking", label: "Ranking" },
];

const ABOUT_LINKS = [
  { href: "/landing#story", label: "Story" },
  { href: "/landing#how-it-works", label: "How it works" },
  { href: "/landing#contact", label: "Contact" },
];

const LOCALES = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [auth, setAuth] = useState({ loading: true, authenticated: false });
  const [locale, setLocale] = useState("en");
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("status unavailable");
        const data = await response.json();
        setAuth({ loading: false, authenticated: data.authenticated === true });
      })
      .catch(() => setAuth({ loading: false, authenticated: false }));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie.match(/(?:^|; )router2k.locale=([^;]+)/);
    if (match) setLocale(decodeURIComponent(match[1]));
  }, []);

  const setLocaleCookie = (next) => {
    setLocale(next);
    if (typeof document !== "undefined") {
      document.cookie = `router2k.locale=${encodeURIComponent(next)};path=/;max-age=31536000`;
      document.documentElement.lang = next === "zh" ? "zh" : "en";
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          aria-label="Router2k home"
          className="flex items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md pr-1"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon name="route" className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Router2k</span>
        </Link>

        {/* Center nav */}
        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center justify-center gap-1 lg:flex"
        >
          <NavLink href="/" label="Home" />
          <NavMenu label="Developers" items={DEVELOPER_LINKS} />
          <NavLink href="/#models" label="Models" />
          <NavLink href="/#endpoint" label="Endpoint" />
          <NavLink href="/ranking" label="Ranking" />
          <NavMenu label="About" items={ABOUT_LINKS} />
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AnnouncementsButton open={announcementsOpen} onOpenChange={setAnnouncementsOpen} />

          <div
            role="group"
            aria-label="Change language"
            className="hidden h-8 items-center rounded-md border p-0.5 text-sm sm:flex"
          >
            {LOCALES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={locale === entry.value}
                onClick={() => setLocaleCookie(entry.value)}
                className={cn(
                  "flex h-full min-w-9 items-center justify-center rounded-sm px-2 text-sm font-medium transition-colors",
                  locale === entry.value
                    ? "bg-foreground/90 text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {auth.loading ? (
            <div className="hidden h-8 w-[120px] sm:block" aria-hidden />
          ) : auth.authenticated ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/dashboard">
                Dashboard
                <Icon name="arrow_outward" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/login?mode=register">
                  Get API key
                  <Icon name="arrow_forward" />
                </Link>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t pt-3 sm:hidden">
              {auth.authenticated ? (
                <Button asChild className="w-full">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/login?mode=register">Get API key</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({ href, label }) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function NavMenu({ label, items }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {label}
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnnouncementsButton({ open, onOpenChange }) {
  // Placeholder: opens a popover of recent product notes. Currently a no-op
  // until the announcements API is wired in.
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Announcements"
      title="Announcements"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      <Icon name="campaign" />
    </Button>
  );
}
