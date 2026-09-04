"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PropTypes from "prop-types";
import { Menu, Search, X } from "lucide-react";

import ProviderIcon from "./ProviderIcon";
import AccountMenu from "./AccountMenu";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { notify } from "@/store/notificationStore";
import { getPageMeta } from "@/shared/constants/pageMeta";
import { translate } from "@/i18n/runtime";

/**
 * The header no longer carries a shell switch.
 *
 * There used to be a quick admin/user toggle here that wrote a
 * `dashboard_view_mode` cookie, while the avatar menu and the admin rail
 * switched shells by plain navigation without touching it. Three switches, one
 * of which persisted state, meant the URL you were on and the mode the server
 * believed you were in drifted apart constantly — an admin standing in /admin
 * could be refused Activity, lose pricing controls and have nav rows vanish.
 *
 * Which shell you are in is now simply which route group you are in, and the
 * only way to change it is `AccountMenu`.
 */
export default function Header({ onMenuClick, showMenuButton = true, variant = "user" }) {
  const pathname = usePathname();
  const [account, setAccount] = useState(null);

  const { title, description, breadcrumbs } = getPageMeta(pathname);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAccount({
          displayName: data?.displayName || data?.oidcName || data?.oidcEmail || "",
          role: data?.role || "",
          creditCents: Number.isSafeInteger(data?.user?.creditCents) ? data.user.creditCents : null,
        });
      } catch {
        if (cancelled) return;
        setAccount(null);
      }
    }

    loadAuthStatus();
    window.addEventListener("account-profile-updated", loadAuthStatus);
    return () => {
      cancelled = true;
      window.removeEventListener("account-profile-updated", loadAuthStatus);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) window.location.assign("/login");
    } catch {
      notify.error("Could not sign out. Try again.");
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      {showMenuButton ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="shrink-0 lg:hidden"
        >
          <Menu />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {breadcrumbs.length > 0 ? (
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <BreadcrumbItem key={`${crumb.label}-${crumb.href || "current"}`}>
                    {index > 0 ? <BreadcrumbSeparator className="mr-1.5" /> : null}
                    {crumb.href && !last ? (
                      <BreadcrumbLink href={crumb.href} className="hidden sm:inline">
                        {translate(crumb.label)}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="flex min-w-0 items-center gap-2">
                        {crumb.image ? (
                          <ProviderIcon
                            src={crumb.image}
                            alt={crumb.label}
                            size={18}
                            className="size-[18px] rounded object-contain"
                            fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                          />
                        ) : null}
                        <span className="truncate font-semibold">{translate(crumb.label)}</span>
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : title ? (
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="shrink-0 truncate font-semibold lg:text-lg">{translate(title)}</h1>
            {description ? (
              <p className="hidden truncate text-sm text-muted-foreground xl:block">
                {translate(description)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <HeaderSearch />
        {account?.displayName ? (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-6" />
            <AccountMenu
              displayName={account.displayName}
              role={account.role}
              creditCents={account.creditCents}
              variant={variant}
              onLogout={handleLogout}
            />
          </>
        ) : null}
      </div>
    </header>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
  variant: PropTypes.oneOf(["user", "admin"]),
};

/** Search box for pages that register one; hidden otherwise. */
function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative w-[150px] sm:w-[220px] xl:w-[280px]">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder || "Search"}
        className="h-8 pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-0.5 top-1/2 -translate-y-1/2"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
