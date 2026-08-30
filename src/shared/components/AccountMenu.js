"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { ChevronDown, LogOut, Plus, UserCog } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Identity control at the right end of the page header. The menu opens downward
 * and right-aligned because the trigger is pinned to the top edge; below `sm`
 * the name and role collapse away and only the square avatar remains, so the
 * header keeps room for page context.
 */
export default function AccountMenu({ displayName, role, creditCents, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const hasCredit = Number.isSafeInteger(creditCents);
  const formattedCredit = hasCredit ? CREDIT_FORMAT.format(creditCents / 100) : null;
  const avatarLabel = String(displayName || "A").trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!displayName) return null;

  const subtitle = [role || "user", formattedCredit].filter(Boolean).join(" · ");

  return (
    <div className="relative flex shrink-0 items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        title={displayName}
        className={cn(
          "flex h-9 items-center rounded-sm text-left transition-colors",
          "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          "justify-center px-0 sm:w-auto sm:justify-start sm:gap-2 sm:px-1.5"
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-[11px] font-semibold text-text-main">
          {avatarLabel}
        </span>
        <span className="hidden min-w-0 max-w-[9rem] sm:block">
          <span className="block truncate text-[13px] font-medium leading-tight text-text-main">
            {displayName}
          </span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
            {subtitle}
          </span>
        </span>
        <ChevronDown aria-hidden size={14} strokeWidth={2.25} className="hidden shrink-0 text-text-subtle sm:block" />
      </button>

      {/* Top-up sits beside the balance in the corner. Hidden below `sm`, where
          the trigger collapses to the avatar and the balance is not shown —
          the menu's own balance row carries the same link there. */}
      {hasCredit && (
        <Link
          href="/dashboard/account?tab=wallet"
          aria-label="Add credit"
          title="Add credit"
          onClick={() => onNavigate?.()}
          className="hidden size-7 shrink-0 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 sm:flex"
        >
          <Plus aria-hidden size={14} strokeWidth={2.75} />
        </Link>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 border border-border bg-surface"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text-main">{displayName}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              {role || "user"} account
            </p>
            {hasCredit && (
              <div className="mt-2 flex items-center justify-between gap-2 border border-border pl-2.5 sm:pr-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Balance
                </span>
                <span className="flex min-w-0 items-center">
                  <span className="truncate py-1.5 font-mono text-xs font-semibold tabular-nums text-text-main">
                    {formattedCredit}
                  </span>
                  {/* Below `sm` the corner control is hidden (the trigger is the
                      avatar alone), so the menu carries top-up there instead. */}
                  <Link
                    href="/dashboard/account?tab=wallet"
                    role="menuitem"
                    aria-label="Add credit"
                    title="Add credit"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="ml-1.5 flex size-7 shrink-0 items-center justify-center border-l border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main sm:hidden"
                  >
                    <Plus aria-hidden size={14} strokeWidth={2.75} />
                  </Link>
                </span>
              </div>
            )}
          </div>
          <div className="p-1">
            {role === "admin" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                Admin Panel
              </Link>
            )}
            <Link
              href="/dashboard/account"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <UserCog aria-hidden size={15} strokeWidth={2.25} className="text-text-muted" />
              Profile &amp; account
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut aria-hidden size={15} strokeWidth={2.25} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

AccountMenu.propTypes = {
  displayName: PropTypes.string,
  role: PropTypes.string,
  creditCents: PropTypes.number,
  onLogout: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
};
