"use client";

import Link from "next/link";
import PropTypes from "prop-types";
import { ChevronDown, LogOut, Plus, ShieldCheck, UserCog } from "lucide-react";

import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Identity control at the right end of the page header.
 *
 * Radix owns the menu: outside-click, Escape, roving focus and return-focus were
 * all hand-wired before, and the roving focus in particular was missing.
 * Below `sm` the name and role collapse away and only the avatar remains, so the
 * header keeps room for page context.
 */
export default function AccountMenu({ displayName, role, creditCents, onLogout, onNavigate }) {
  if (!displayName) return null;

  const hasCredit = Number.isSafeInteger(creditCents);
  const formattedCredit = hasCredit ? CREDIT_FORMAT.format(creditCents / 100) : null;
  const initial = String(displayName || "A").trim().charAt(0).toUpperCase() || "A";
  const subtitle = [role || "user", formattedCredit].filter(Boolean).join(" · ");

  return (
    <div className="flex shrink-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={displayName}
            aria-label={`Account menu for ${displayName}`}
            className="flex h-9 items-center gap-2 rounded-md px-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:pr-2"
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-[11px] font-medium">{initial}</AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 max-w-[9rem] sm:block">
              <span className="block truncate text-sm font-medium leading-tight">{displayName}</span>
              <span className="block truncate text-xs capitalize text-muted-foreground">
                {subtitle}
              </span>
            </span>
            <ChevronDown aria-hidden className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="pb-2">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-0.5 text-xs font-normal capitalize text-muted-foreground">
              {role || "user"} account
            </p>
          </DropdownMenuLabel>

          {hasCredit ? (
            <>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="text-xs text-muted-foreground">Balance</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-medium tabular-nums">
                    {formattedCredit}
                  </span>
                  {/* Below `sm` the corner top-up is hidden (the trigger is the
                      avatar alone), so this row carries the link there. */}
                  <Button
                    asChild
                    variant="outline"
                    size="icon-xs"
                    className="sm:hidden"
                    onClick={() => onNavigate?.()}
                  >
                    <Link href="/dashboard/account?tab=wallet" aria-label="Add credit">
                      <Plus />
                    </Link>
                  </Button>
                </span>
              </div>
            </>
          ) : null}

          <DropdownMenuSeparator />

          {role === "admin" ? (
            <DropdownMenuItem asChild onSelect={() => onNavigate?.()}>
              <Link href="/admin">
                <ShieldCheck />
                Admin panel
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild onSelect={() => onNavigate?.()}>
            <Link href="/dashboard/account">
              <UserCog />
              Profile &amp; account
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={onLogout}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasCredit ? (
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          className="hidden sm:inline-flex"
          onClick={() => onNavigate?.()}
        >
          <Link href="/dashboard/account?tab=wallet" aria-label="Add credit" title="Add credit">
            <Plus />
          </Link>
        </Button>
      ) : null}
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
