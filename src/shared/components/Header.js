"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PropTypes from "prop-types";
import { Menu, Search, ShieldCheck, User, X } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { notify } from "@/store/notificationStore";
import { getPageMeta } from "@/shared/constants/pageMeta";
import { translate } from "@/i18n/runtime";
import { DASHBOARD_VIEW_ADMIN, DASHBOARD_VIEW_USER } from "@/shared/constants/dashboardView";

/** Routes a user-view session may stay on after switching out of admin view. */
const USER_VIEW_SAFE_PREFIXES = [
  "/dashboard/api-keys",
  "/dashboard/usage",
  "/dashboard/models",
  "/dashboard/account",
];

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState(DASHBOARD_VIEW_USER);
  const [canSwitchDashboardView, setCanSwitchDashboardView] = useState(false);
  const [switchingView, setSwitchingView] = useState(false);
  const [account, setAccount] = useState(null);

  const { title, description, breadcrumbs } = getPageMeta(pathname);

  // One auth read serves both the view-mode switch and the identity menu.
  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setViewMode(data?.viewMode || DASHBOARD_VIEW_USER);
        setCanSwitchDashboardView(data?.canSwitchDashboardView === true);
        setAccount({
          displayName: data?.displayName || data?.oidcName || data?.oidcEmail || "",
          role: data?.role || "",
          creditCents: Number.isSafeInteger(data?.user?.creditCents) ? data.user.creditCents : null,
        });
      } catch {
        if (cancelled) return;
        setViewMode(DASHBOARD_VIEW_USER);
        setCanSwitchDashboardView(false);
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

  const handleViewModeToggle = async () => {
    if (switchingView) return;
    const nextMode = viewMode === DASHBOARD_VIEW_ADMIN ? DASHBOARD_VIEW_USER : DASHBOARD_VIEW_ADMIN;
    setSwitchingView(true);
    try {
      const response = await fetch("/api/auth/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to switch dashboard view");
      if (body.viewMode !== DASHBOARD_VIEW_ADMIN && body.viewMode !== DASHBOARD_VIEW_USER) {
        throw new Error("Invalid dashboard view response");
      }

      // A full navigation, not a router push: the view mode is a cookie the
      // server reads for route gating, so every RSC payload has to be refetched.
      if (body.viewMode === DASHBOARD_VIEW_ADMIN) {
        window.location.assign("/admin");
        return;
      }
      const safe =
        pathname === "/dashboard" ||
        USER_VIEW_SAFE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      window.location.assign(safe ? pathname : "/dashboard");
    } catch {
      notify.error("Could not switch dashboard view. Try again.");
      setSwitchingView(false);
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
        {canSwitchDashboardView ? (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-6" />
            <ViewModeToggle
              mode={viewMode}
              pending={switchingView}
              onToggle={handleViewModeToggle}
            />
          </>
        ) : null}
        {account?.displayName ? (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-6" />
            <AccountMenu
              displayName={account.displayName}
              role={account.role}
              creditCents={account.creditCents}
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
};

function ViewModeToggle({ mode, pending, onToggle }) {
  const adminView = mode === DASHBOARD_VIEW_ADMIN;
  const ModeIcon = adminView ? ShieldCheck : User;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="switch"
          aria-checked={adminView}
          aria-label="Admin dashboard view"
          aria-busy={pending}
          disabled={pending}
          onClick={onToggle}
        >
          <ModeIcon />
          <span className="hidden sm:inline">{adminView ? "Admin" : "User"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {adminView ? "user" : "admin"} view</TooltipContent>
    </Tooltip>
  );
}

ViewModeToggle.propTypes = {
  mode: PropTypes.oneOf([DASHBOARD_VIEW_ADMIN, DASHBOARD_VIEW_USER]).isRequired,
  pending: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
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
