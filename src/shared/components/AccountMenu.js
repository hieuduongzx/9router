"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Identity row at the foot of the sidebar rail (it used to sit in the page
 * header). The menu opens upward because the trigger is pinned to the bottom of
 * the viewport, and collapses to the avatar alone on the 64px rail.
 */
export default function AccountMenu({
  displayName,
  role,
  creditCents,
  collapsed = false,
  onLogout,
  onNavigate,
}) {
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
    <div className={cn("relative", collapsed ? "shrink-0" : "min-w-0 flex-1")} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        title={collapsed ? displayName : undefined}
        className={cn(
          "flex items-center rounded-sm text-left transition-colors",
          "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          collapsed ? "size-8 justify-center" : "h-11 w-full gap-2.5 px-1.5"
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center border border-border bg-surface-2 font-mono text-[11px] font-semibold text-text-main">
          {avatarLabel}
        </span>
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight text-text-main">
                {displayName}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                {subtitle}
              </span>
            </span>
            <ChevronsUpDown aria-hidden size={14} strokeWidth={2.25} className="shrink-0 text-text-subtle" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full z-50 mb-2 w-60 border border-border bg-surface",
            collapsed ? "left-0" : "left-0 right-0 w-auto min-w-[15rem]"
          )}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text-main">{displayName}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              {role || "user"} account
            </p>
            {hasCredit && (
              <div className="mt-2 flex items-center justify-between gap-3 border border-border px-2.5 py-1.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Balance
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-text-main">
                  {formattedCredit}
                </span>
              </div>
            )}
          </div>
          <div className="p-1">
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
  collapsed: PropTypes.bool,
  onLogout: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
};
