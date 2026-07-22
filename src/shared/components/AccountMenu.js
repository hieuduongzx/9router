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
    <div className="relative ml-0.5 sm:ml-1" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={displayName ? `Account menu for ${displayName}` : "Open account menu"}
        className="flex size-11 max-w-[220px] items-center justify-center gap-2 rounded-full border border-border bg-surface p-1 text-left text-text-muted transition-colors hover:border-border hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:w-auto sm:justify-start sm:pr-2.5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {avatarLabel}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[120px] truncate text-[13px] font-semibold leading-tight text-text-main">
            {displayName}
          </span>
          {formattedCredit && (
            <span className="mt-0.5 block whitespace-nowrap text-[11px] font-medium leading-none text-primary tabular-nums">
              {formattedCredit}
            </span>
          )}
        </span>
        <span className="ml-0.5 hidden shrink-0 sm:inline-flex">
          <span className="material-symbols-outlined text-[16px] text-text-muted">expand_more</span>
        </span>
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
