"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function AccountMenu({ displayName, role, creditCents, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const formattedCredit = Number.isSafeInteger(creditCents) ? CREDIT_FORMAT.format(creditCents / 100) : null;
  const avatarLabel = String(displayName || "A").trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  if (!displayName) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className="flex max-w-[260px] items-center gap-2 rounded-full border border-border bg-surface/70 py-1 pl-1 pr-2 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {avatarLabel}
        </span>
        <span className="min-w-0 text-left">
          <span className="hidden max-w-[112px] truncate text-[11px] font-medium leading-none text-text-main sm:block">{displayName}</span>
          {formattedCredit && (
            <span className="block whitespace-nowrap text-[10px] font-semibold leading-none text-primary tabular-nums sm:mt-1">
              <span className="hidden font-medium text-text-muted sm:inline">Balance </span>{formattedCredit}
            </span>
          )}
        </span>
        {role && (
          <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary xl:inline">
            {role}
          </span>
        )}
        <span className="material-symbols-outlined text-[15px]">expand_more</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-elev)]">
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="truncate text-sm font-semibold text-text-main">{displayName}</p>
            <p className="mt-0.5 text-xs capitalize text-text-muted">{role || "user"} account</p>
            {Number.isSafeInteger(creditCents) && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-primary/[0.06] px-2.5 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Balance</span>
                <span className="text-xs font-semibold tabular-nums text-text-main">
                  {CREDIT_FORMAT.format(creditCents / 100)}
                </span>
              </div>
            )}
          </div>
          <div className="p-1.5">
            <Link
              href="/dashboard/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[19px] text-text-muted">manage_accounts</span>
              Profile & account
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <span className="material-symbols-outlined text-[19px]">logout</span>
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
};
