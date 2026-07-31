"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import AccountMenu from "@/shared/components/AccountMenu";
import HeaderLanguage from "@/shared/components/HeaderLanguage";
import ThemeToggle from "@/shared/components/ThemeToggle";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { translate } from "@/i18n/runtime";
import {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_USER,
} from "@/shared/constants/dashboardView";

const getPageInfo = (pathname) => {
  if (!pathname) return { title: "", description: "", breadcrumbs: [] };

  // Media provider detail: /dashboard/media-providers/[kind]/[id]
  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const kindId = mediaDetailMatch[1];
    const providerId = mediaDetailMatch[2];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    const provider = AI_PROVIDERS[providerId];
    return {
      title: provider?.name || providerId,
      description: "",
      breadcrumbs: [
        { label: "Media Providers", href: `/dashboard/media-providers/${kindId}` },
        { label: kindConfig?.label || kindId, href: `/dashboard/media-providers/${kindId}` },
        { label: provider?.name || providerId, image: getProviderIconSrc(providerId) },
      ],
    };
  }

  // Media provider kind: /dashboard/media-providers/[kind]
  const mediaKindMatch = pathname.match(/\/media-providers\/([^/]+)$/);
  if (mediaKindMatch) {
    const kindId = mediaKindMatch[1];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    return {
      title: kindConfig?.label || kindId,
      description: `Manage your ${kindConfig?.label || kindId} providers`,
      icon: kindConfig?.icon || "perm_media",
      breadcrumbs: [],
    };
  }

  // Provider detail page: /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerId = providerMatch[1];
    const providerInfo =
      OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
    if (providerInfo) {
      return {
        title: providerInfo.name,
        description: "",
        breadcrumbs: [
          { label: "Providers", href: "/dashboard/providers" },
          {
            label: providerInfo.name,
            image: getProviderIconSrc(providerInfo.id),
          },
        ],
      };
    }
  }

  if (pathname.includes("/providers") && !pathname.includes("/media-providers"))
    return {
      title: "Providers",
      description: "Manage your AI provider connections",
      icon: "dns",
      breadcrumbs: [],
    };
  if (pathname.includes("/combos"))
    return {
      title: "Model Routes",
      description: "Public model routing and ownership",
      icon: "alt_route",
      breadcrumbs: [],
    };
  if (pathname.includes("/activity"))
    return {
      title: "Activity",
      description: "Admin operations for system, providers, and requests",
      icon: "monitoring",
      breadcrumbs: [],
    };
  if (pathname.includes("/usage"))
    return {
      title: "Usage",
      description: "Model tokens, cost, and account-scoped request history",
      icon: "bar_chart",
      breadcrumbs: [],
    };
  if (pathname.includes("/auth-files"))
    return {
      title: "Auth Files",
      description: "Map provider credentials stored in the local database",
      icon: "vpn_key",
      breadcrumbs: [],
    };
  if (pathname.includes("/quota"))
    return {
      title: "Quota Tracker",
      description: "Track and manage your API quota limits",
      icon: "data_usage",
      breadcrumbs: [],
    };
  if (pathname.includes("/mitm"))
    return {
      title: "MITM Proxy",
      description: "Intercept CLI tool traffic and route through Router2k",
      icon: "security",
      breadcrumbs: [],
    };
  if (pathname.includes("/token-saver"))
    return {
      title: "Token Saver",
      description: "Compress prompts and outputs to save tokens",
      icon: "savings",
      breadcrumbs: [],
    };
  if (pathname.includes("/cli-tools"))
    return {
      title: "CLI Tools",
      description: "Configure CLI tools",
      icon: "terminal",
      breadcrumbs: [],
    };
  if (pathname.includes("/proxy-pools"))
    return {
      title: "Proxy Pools",
      description: "Manage your proxy pool configurations",
      icon: "lan",
      breadcrumbs: [],
    };
  if (pathname.includes("/skills"))
    return {
      title: "Agent Skills",
      description: "Copy a link and paste to your AI to use Router2k — no install needed",
      icon: "extension",
      breadcrumbs: [],
    };
  if (pathname.includes("/models"))
    return {
      title: "Models",
      description: "Available routed models",
      icon: "deployed_code",
      breadcrumbs: [],
    };
  if (pathname.includes("/api-keys"))
    return {
      title: "API Keys",
      description: "Manage authentication keys for /v1",
      icon: "vpn_key",
      breadcrumbs: [],
    };
  if (pathname.includes("/endpoint"))
    return {
      title: "Endpoint",
      description: "API endpoint configuration",
      icon: "api",
      breadcrumbs: [],
    };
  // Account detail page: /dashboard/users/[id]
  if (/\/users\/[^/]+$/.test(pathname))
    return {
      title: "Account detail",
      description: "Access, credit, keys, and usage for one account",
      icon: "manage_accounts",
      breadcrumbs: [
        { label: "Accounts", href: "/dashboard/users" },
        { label: "Detail" },
      ],
    };
  if (pathname.includes("/users"))
    return {
      title: "Accounts",
      description: "Manage account access and roles",
      icon: "manage_accounts",
      breadcrumbs: [],
    };
  if (pathname.includes("/account"))
    return {
      title: "Account",
      description: "Profile, wallet, and sign-in security",
      icon: "account_circle",
      breadcrumbs: [],
    };
  if (pathname.includes("/settings"))
    return {
      title: "Settings",
      description: "Manage system preferences and access",
      icon: "settings",
      breadcrumbs: [],
    };
  if (pathname.includes("/translator"))
    return {
      title: "Translator",
      description: "Debug translation flow between formats",
      icon: "translate",
      breadcrumbs: [],
    };
  if (pathname.includes("/console-log"))
    return {
      title: "Console Log",
      description: "Live server console output",
      icon: "monitor",
      breadcrumbs: [],
    };
  if (pathname === "/dashboard" || pathname === "/dashboard/")
    return {
      title: "Home",
      description: "Model traffic, access, and account status at a glance",
      icon: "home",
      breadcrumbs: [],
    };
  return { title: "", description: "", breadcrumbs: [] };
};

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [creditCents, setCreditCents] = useState(null);
  const [viewMode, setViewMode] = useState(DASHBOARD_VIEW_USER);
  const [canSwitchDashboardView, setCanSwitchDashboardView] = useState(false);
  const [switchingView, setSwitchingView] = useState(false);
  const [viewModeError, setViewModeError] = useState("");

  // Memoize page info to prevent unnecessary recalculations
  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);
  const { title, description, icon, breadcrumbs } = pageInfo;

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setDisplayName(data?.displayName || data?.oidcName || data?.oidcEmail || "");
          setRole(data?.role || "");
          setCreditCents(Number.isSafeInteger(data?.user?.creditCents) ? data.user.creditCents : null);
          setViewMode(data?.viewMode || DASHBOARD_VIEW_USER);
          setCanSwitchDashboardView(data?.canSwitchDashboardView === true);
        }
      } catch {
        if (!cancelled) {
          setDisplayName("");
          setRole("");
          setCreditCents(null);
          setViewMode(DASHBOARD_VIEW_USER);
          setCanSwitchDashboardView(false);
        }
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
      if (res.ok) {
        window.location.assign("/login");
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  const handleViewModeToggle = async () => {
    if (switchingView) return;
    const nextMode = viewMode === DASHBOARD_VIEW_ADMIN ? DASHBOARD_VIEW_USER : DASHBOARD_VIEW_ADMIN;
    setSwitchingView(true);
    setViewModeError("");
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
      const resolvedMode = body.viewMode;
      setViewMode(resolvedMode);
      const userViewSafePath = pathname === "/dashboard"
        || pathname === "/dashboard/"
        || ["/dashboard/api-keys", "/dashboard/usage", "/dashboard/models", "/dashboard/account"]
          .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (resolvedMode === DASHBOARD_VIEW_USER && !userViewSafePath) {
        window.location.assign("/dashboard");
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to switch dashboard view:", error);
      setViewModeError("Could not switch dashboard view. Try again.");
      setSwitchingView(false);
    }
  };

  return (
    <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-8">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3 lg:hidden shrink-0">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-text-main hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
      </div>

      {/* Page title with breadcrumbs */}
      <div className="flex flex-col min-w-0 flex-1">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2">
            {breadcrumbs.map((crumb, index) => (
              <div
                key={`${crumb.label}-${crumb.href || "current"}`}
                className="flex items-center gap-2"
              >
                {index > 0 && (
                  <span className="material-symbols-outlined text-text-muted text-base">
                    chevron_right
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-text-muted hover:text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    {crumb.image && (
                      <ProviderIcon
                        src={crumb.image}
                        alt={crumb.label}
                        size={28}
                        className="object-contain rounded-sm max-w-[28px] max-h-[28px]"
                        fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                      />
                    )}
                    <h1 className="font-mono text-base lg:text-xl font-semibold text-text-main tracking-tight truncate">
                      {translate(crumb.label)}
                    </h1>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : title ? (
          <div>
            <div className="flex items-center gap-2">
              {icon && (
                <span className="material-symbols-outlined text-text-main text-xl lg:text-2xl">
                  {icon}
                </span>
              )}
              <h1 className="font-mono text-base lg:text-xl font-semibold tracking-tight truncate">
                {translate(title)}
              </h1>
            </div>
            {description && (
              <p className="hidden lg:block text-sm text-text-muted truncate">
                {translate(description)}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Right actions: utilities first, profile owns the far-right corner */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <HeaderSearch />
        <div className="hidden sm:block"><ThemeToggle /></div>
        <HeaderLanguage />
        {canSwitchDashboardView && (
          <div className="sm:ml-1 sm:border-l sm:border-border sm:pl-2">
            <DashboardViewToggle
              mode={viewMode}
              pending={switchingView}
              onToggle={handleViewModeToggle}
            />
          </div>
        )}
        <AccountMenu displayName={displayName} role={role} creditCents={creditCents} onLogout={handleLogout} />
      </div>
      {viewModeError && (
        <div
          role="alert"
          className="fixed right-4 top-16 z-50 max-w-sm rounded-sm border border-danger/25 bg-surface px-4 py-3 text-sm font-medium text-danger"
        >
          {viewModeError}
        </div>
      )}
    </header>
  );
}

function DashboardViewToggle({ mode, pending, onToggle }) {
  const adminView = mode === DASHBOARD_VIEW_ADMIN;
  const targetLabel = adminView ? "User" : "Admin";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={adminView}
      aria-label="Admin dashboard view"
      title={`Switch to ${targetLabel} view`}
      aria-busy={pending}
      disabled={pending}
      onClick={onToggle}
      className="inline-flex h-11 items-center gap-2 rounded-sm border border-border bg-surface px-2 font-mono text-xs font-medium text-text-main transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60 sm:h-9 xl:px-2.5"
    >
      <span className={`material-symbols-outlined text-[18px] ${pending ? "animate-spin text-text-main" : adminView ? "text-text-main" : "text-text-muted"}`}>
        {pending ? "progress_activity" : adminView ? "admin_panel_settings" : "person"}
      </span>
      <span>{adminView ? "Admin" : "User"}<span className="hidden xl:inline"> view</span></span>
      <span
        aria-hidden="true"
        className={`relative hidden h-4 w-7 rounded-full transition-colors sm:block ${adminView ? "bg-primary" : "bg-text-subtle/40"}`}
      >
        <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform ${adminView ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

DashboardViewToggle.propTypes = {
  mode: PropTypes.oneOf([DASHBOARD_VIEW_ADMIN, DASHBOARD_VIEW_USER]).isRequired,
  pending: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative w-[160px] sm:w-[220px]">
      <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[16px] pointer-events-none">
        search
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 pl-7 pr-7 rounded-sm border border-border bg-surface/60 font-mono text-sm focus:outline-none focus:border-primary transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};
