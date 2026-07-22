"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];
const COMBINED_WEB_ITEM = {
  id: "web",
  label: "Web Fetch & Search",
  icon: "travel_explore",
  href: "/dashboard/media-providers/web",
};

const GLOBAL_NAV = [
  { href: "/dashboard", label: "Home", icon: "home", exact: true },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "vpn_key" },
  { href: "/dashboard/models", label: "Models", icon: "deployed_code" },
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
];

const PERSONAL_NAV = [
  { href: "/dashboard/account", label: "Profile", icon: "person", exact: true },
  { href: "/dashboard/account?tab=wallet", label: "Wallet", icon: "account_balance_wallet", match: "wallet" },
  { href: "/dashboard/account?tab=security", label: "Security", icon: "lock", match: "security" },
];

const ADMIN_NAV = [
  { href: "/dashboard/activity", label: "Activity", icon: "monitoring" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/quota", label: "Quota", icon: "data_usage" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
  { href: "/dashboard/users", label: "Accounts", icon: "manage_accounts" },
];

const SYSTEM_NAV = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
];

const DEBUG_NAV = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate", requiresTranslator: true },
];

function isPathActive(pathname, href, exact = false) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ href, label, icon, active, onClick, nested = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        nested ? "h-8 px-2.5" : "h-9 px-2.5",
        active
          ? "bg-primary/10 text-primary"
          : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <span
        className={cn(
          "material-symbols-outlined shrink-0 text-[18px] transition-colors",
          active ? "fill-1 text-primary" : "text-text-muted group-hover:text-text-main"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

NavItem.propTypes = {
  href: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  nested: PropTypes.bool,
};

function NavSection({ title, children, className }) {
  return (
    <div className={cn("space-y-1", className)}>
      {title ? (
        <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted/70">
          {title}
        </p>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

NavSection.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};

function NavSubsection({ title, children }) {
  return (
    <div className="pt-2">
      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted/60">
        {title}
      </p>
      <div className="ml-2 space-y-0.5 border-l border-border/70 pl-2">{children}</div>
    </div>
  );
}

NavSubsection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountTab = searchParams?.get("tab") || "profile";
  const onMediaRoute = pathname.startsWith("/dashboard/media-providers");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const mediaExpanded = mediaOpen || onMediaRoute;
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  const mediaKinds = useMemo(
    () => MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)),
    []
  );



  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const admin = data.isAdminView === true;
        setIsAdmin(admin);
        if (!admin) return null;
        return fetch("/api/settings")
          .then((res) => (res.ok ? res.json() : null))
          .then((settings) => {
            if (settings?.enableTranslator) setEnableTranslator(true);
          });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasUpdate) setUpdateInfo(data);
      })
      .catch(() => {});
  }, []);

  const handleUpdate = () => {
    setShowUpdateModal(false);
    setIsUpdating(true);
  };

  const handleCopyAndShutdown = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
    } catch {
      /* clipboard blocked */
    }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setShutdownCountdown(0);
  };

  const debugItems = DEBUG_NAV.filter(
    (item) => !item.requiresTranslator || enableTranslator
  );

  return (
    <>
      <aside className="flex h-full min-h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Brand header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-sm">
              <span className="material-symbols-outlined text-[18px]">route</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-tight text-text-main">
                {APP_CONFIG.name}
              </div>
              <div className="truncate text-[11px] text-text-muted">
                v{APP_CONFIG.version}
              </div>
            </div>
          </Link>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main lg:hidden"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          ) : null}
        </div>

        {/* Update banner */}
        {isAdmin && updateInfo ? (
          <div className="shrink-0 border-b border-border px-3 py-2.5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="material-symbols-outlined text-[14px]">system_update</span>
                <span>v{updateInfo.latestVersion} available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(true)}
                  className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => copy(INSTALL_CMD)}
                  title={INSTALL_CMD}
                  className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-2 py-1 text-left font-mono text-[10px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                >
                  {copied ? "✓ copied" : INSTALL_CMD}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          <NavSection>
            {GLOBAL_NAV.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isPathActive(pathname, item.href, item.exact)}
                onClick={onClose}
              />
            ))}
          </NavSection>



          {isAdmin && (
            <NavSection title="Admin" className="mt-2 border-t border-border/70">
              {ADMIN_NAV.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isPathActive(pathname, item.href)}
                  onClick={onClose}
                />
              ))}

              <NavSubsection title="Media">
                <button
                  type="button"
                  onClick={() => setMediaOpen((value) => !value)}
                  aria-expanded={mediaExpanded}
                  className={cn(
                    "group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    onMediaRoute
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-[18px]",
                      onMediaRoute ? "fill-1 text-primary" : "text-text-muted group-hover:text-text-main"
                    )}
                  >
                    perm_media
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">Media Providers</span>
                  <span
                    className={cn(
                      "material-symbols-outlined text-[16px] text-text-muted transition-transform duration-200",
                      mediaExpanded && "rotate-180"
                    )}
                  >
                    expand_more
                  </span>
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    mediaExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="relative ml-3.5 mt-0.5 space-y-0.5 border-l border-border py-0.5 pl-2.5">
                      {mediaKinds.map((kind) => (
                        <NavItem
                          key={kind.id}
                          href={`/dashboard/media-providers/${kind.id}`}
                          label={kind.label}
                          icon={kind.icon}
                          nested
                          active={pathname.startsWith(`/dashboard/media-providers/${kind.id}`)}
                          onClick={onClose}
                        />
                      ))}
                      <NavItem
                        href={COMBINED_WEB_ITEM.href}
                        label={COMBINED_WEB_ITEM.label}
                        icon={COMBINED_WEB_ITEM.icon}
                        nested
                        active={pathname.startsWith(COMBINED_WEB_ITEM.href)}
                        onClick={onClose}
                      />
                    </div>
                  </div>
                </div>
              </NavSubsection>

              <NavSubsection title="System">
                {SYSTEM_NAV.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    nested
                    active={isPathActive(pathname, item.href)}
                    onClick={onClose}
                  />
                ))}
                {debugItems.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    nested
                    active={isPathActive(pathname, item.href)}
                    onClick={onClose}
                  />
                ))}
              </NavSubsection>
            </NavSection>
          )}

          <NavSection title="Personal" className="mt-2 border-t border-border/70">
            {PERSONAL_NAV.map((item) => {
              const onAccount = pathname === "/dashboard/account" || pathname.startsWith("/dashboard/account/");
              let active = false;
              if (item.match === "wallet") active = onAccount && accountTab === "wallet";
              else if (item.match === "security") active = onAccount && accountTab === "security";
              else active = onAccount && (accountTab === "profile" || !accountTab || accountTab === "");
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  onClick={onClose}
                />
              );
            })}
          </NavSection>
        </nav>

        {/* Footer */}
        <div className="shrink-0 space-y-1 border-t border-border p-2">
          {isAdmin ? (
            <NavItem
              href="/dashboard/settings"
              label="Settings"
              icon="settings"
              active={isPathActive(pathname, "/dashboard/settings")}
              onClick={onClose}
            />
          ) : null}
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] text-text-muted">Gateway</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Online
            </span>
          </div>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update Router2k"
        message={`Show install command for v${updateInfo?.latestVersion || ""}? You can copy it and shutdown to install manually.`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-white">Server Disconnected</h2>
              <p className="mb-6 text-text-muted">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({
  latestVersion,
  installCmd,
  copied,
  onCopyAndShutdown,
  onCancel,
  countdown,
  isDisconnected,
}) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl border border-white/10 bg-neutral-900/95 p-6 text-white shadow-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/20 text-primary">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            Update Router2k{latestVersion ? ` to v${latestVersion}` : ""}
          </h2>
          <p className="text-xs text-white/60">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="mb-2 text-sm text-white/80">Install command:</p>
      <div className="mb-4 w-full rounded-md bg-white/5 px-3 py-2">
        <code className="break-all font-mono text-xs text-sky-300">{installCmd}</code>
      </div>

      <ol className="mb-4 list-inside list-decimal space-y-1 text-xs text-white/70">
        <li>
          Click <strong>Copy & Shutdown</strong> below.
        </li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>
          Run{" "}
          <code className="rounded bg-white/10 px-1 text-emerald-400">9router</code> again after
          install.
        </li>
      </ol>

      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied
              ? "✓ Copied — shutting down..."
              : isCountingDown
                ? `Shutting down in ${countdown}s`
                : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
