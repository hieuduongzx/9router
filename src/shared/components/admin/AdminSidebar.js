"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  AudioLines,
  Boxes,
  Braces,
  Brush,
  ChartColumn,
  ChevronDown,
  Coins,
  Film,
  Gauge,
  GitFork,
  Globe,
  House,
  Images,
  KeyRound,
  Languages,
  Lock,
  Mic,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  ScrollText,
  Server,
  Settings,
  Terminal,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useSidebarCollapsed } from "@/shared/hooks/useSidebarCollapsed";
import Button from "../Button";
import JumpToPalette from "../JumpToPalette";
import HeaderLanguage from "../HeaderLanguage";
import ThemeToggle from "../ThemeToggle";
import { ConfirmModal } from "../Modal";

const ICON_SIZE = 16;
const STROKE_IDLE = 2.25;
const STROKE_ACTIVE = 2.75;
const STROKE_SMALL = 2.75;

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];

const MEDIA_ICONS = {
  embedding: Braces,
  image: Brush,
  video: Film,
  tts: AudioLines,
  stt: Mic,
};

const COMBINED_WEB_ITEM = {
  id: "web",
  label: "Web Fetch & Search",
  icon: Globe,
  href: "/admin/media-providers/web",
};

// Admin navigation groups - ONLY system management features
// User features (API Keys, Usage, Token Saver, Account) are in user dashboard
const ADMIN_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: House, exact: true },
      { href: "/admin/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    id: "management",
    label: "Management",
    items: [
      { href: "/admin/providers", label: "Providers", icon: Server },
      { href: "/admin/users", label: "Accounts", icon: Users },
      { href: "/admin/combos", label: "Model Routes", icon: GitFork },
      { href: "/admin/models", label: "Models", icon: Boxes },
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    items: [
      { href: "/admin/skills", label: "Skills", icon: Puzzle },
      { href: "/admin/cli-tools", label: "CLI Tools", icon: Terminal },
      { href: "/admin/translator", label: "Translator", icon: Languages },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/quota", label: "Quota", icon: Gauge },
      { href: "/admin/proxy-pools", label: "Proxy Pools", icon: Network },
      { href: "/admin/console-log", label: "Console Log", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isPathActive(pathname, href, exact = false) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminTag() {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-sm border border-border px-1 font-mono text-[9px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-text-subtle"
    >
      Admin
    </span>
  );
}

function NavItem({ href, label, icon: Icon, active, onClick, nested = false, collapsed = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center text-sm outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-primary/40",
        collapsed ? "justify-center px-0" : cn("gap-3 pr-2.5", nested ? "pl-2.5" : "pl-3"),
        active
          ? "font-medium text-text-main"
          : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-0 w-0.5 bg-text-main transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        aria-hidden
        size={ICON_SIZE}
        strokeWidth={active ? STROKE_ACTIVE : STROKE_IDLE}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-text-main" : "text-text-muted group-hover:text-text-main"
        )}
      />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
        {label}
      </span>
    </Link>
  );
}

function GroupLabel({ children, collapsed }) {
  if (collapsed) {
    return (
      <div className="px-2.5 pb-1.5 pt-3.5">
        <span className="block h-px bg-border" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-4">
      <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

function NavGroup({ label, children, collapsed }) {
  return (
    <div>
      <GroupLabel collapsed={collapsed}>{label}</GroupLabel>
      {children}
    </div>
  );
}

export default function AdminSidebar({ onClose }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountTab = searchParams?.get("tab") || "profile";
  const onMediaRoute = pathname.startsWith("/admin/media-providers");
  const [mediaOpen, setMediaOpen] = useState(onMediaRoute);
  const [lastMediaRoute, setLastMediaRoute] = useState(onMediaRoute);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);
  const [storedCollapsed, setCollapsed] = useSidebarCollapsed();

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;
  const isDrawer = Boolean(onClose);
  const collapsed = storedCollapsed && !isDrawer;
  const mediaExpanded = mediaOpen && !collapsed;

  const handleMediaToggle = () => {
    if (collapsed) {
      setCollapsed(false);
      setMediaOpen(true);
      return;
    }
    setMediaOpen((value) => !value);
  };

  const mediaKinds = useMemo(
    () => MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)),
    []
  );

  const navGroups = useMemo(() => ADMIN_NAV_GROUPS, []);

  const paletteItems = useMemo(() => {
    const rows = navGroups.flatMap((group) =>
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        group: group.label,
        icon: item.icon,
      }))
    );
    const media = [
      ...mediaKinds.map((kind) => ({
        href: `/admin/media-providers/${kind.id}`,
        label: kind.label,
        group: "Media",
        icon: MEDIA_ICONS[kind.id] || Images,
      })),
      { href: COMBINED_WEB_ITEM.href, label: COMBINED_WEB_ITEM.label, group: "Media", icon: COMBINED_WEB_ITEM.icon },
    ];
    return [...rows, ...media];
  }, [navGroups, mediaKinds]);

  useEffect(() => {
    if (isDrawer) return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawer]);

  if (onMediaRoute !== lastMediaRoute) {
    setLastMediaRoute(onMediaRoute);
    if (onMediaRoute) setMediaOpen(true);
  }

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
    } catch {}
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

  return (
    <>
      <aside
        className={cn(
          "flex h-full min-h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand header */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center px-0" : "gap-2 px-3"
          )}
        >
          <Link
            href="/admin"
            onClick={onClose}
            title={collapsed ? "Admin Panel" : undefined}
            className={cn(
              "group flex items-center outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
              collapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5 px-1 py-1.5"
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-primary/10 text-primary transition-colors group-hover:border-primary/30">
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            </span>
            <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
              <span className="block truncate font-mono text-sm font-semibold tracking-tight text-text-main">
                Admin Panel
              </span>
            </span>
          </Link>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="flex size-8 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main lg:hidden"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          ) : null}
        </div>

        {/* Jump to... */}
        <div
          className={cn(
            "shrink-0 border-b border-border",
            collapsed ? "flex justify-center py-2.5" : "px-2.5 py-2.5"
          )}
        >
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Jump to page"
            aria-label="Jump to page"
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(
              "flex items-center rounded-sm border border-border bg-surface text-text-muted transition-colors",
              "hover:border-text-subtle hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
              collapsed ? "size-8 justify-center" : "h-8 w-full gap-2 px-2.5"
            )}
          >
            <span className="material-symbols-outlined text-[13px]">search</span>
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[13px]">Jump to...</span>
                <kbd className="shrink-0 rounded-sm border border-border bg-surface-2 px-1 font-mono text-[9px] font-semibold tracking-[0.06em] text-text-subtle">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Update strip */}
        {updateInfo && collapsed ? (
          <div className="flex shrink-0 justify-center border-b border-border bg-surface-2/40 py-2.5">
            <button
              type="button"
              onClick={() => setShowUpdateModal(true)}
              title="Update available"
              aria-label="Update available"
              className="flex size-8 items-center justify-center rounded-sm border border-border text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
            </button>
          </div>
        ) : null}

        {updateInfo && !collapsed ? (
          <div className="shrink-0 border-b border-border bg-surface-2/40 px-2.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Update
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <p className="mt-1.5 truncate text-[13px] font-medium text-text-main">
              A newer release is available
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowUpdateModal(true)}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-primary px-2.5 font-mono text-[11px] font-semibold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-primary/85"
              >
                <span className="material-symbols-outlined text-[13px]">download</span>
                Update
              </button>
              <button
                type="button"
                onClick={() => copy(INSTALL_CMD)}
                title={INSTALL_CMD}
                aria-label="Copy install command"
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2 font-mono text-[11px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
              >
                {copied ? (
                  <span className="material-symbols-outlined text-[13px]">check</span>
                ) : (
                  <span className="material-symbols-outlined text-[13px]">content_copy</span>
                )}
                {copied ? "Copied" : "Command"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <nav
          aria-label="Admin Dashboard"
          className={cn(
            "custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-4",
            collapsed ? "px-0" : "px-2"
          )}
        >
          {navGroups.map((group) => (
            <NavGroup key={group.id} label={group.label} collapsed={collapsed}>
              {/* Media submenu for admin */}
              {group.id === "capabilities" ? (
                <>
                  <button
                    type="button"
                    onClick={handleMediaToggle}
                    aria-expanded={collapsed ? false : mediaOpen}
                    title="Media Providers"
                    className={cn(
                      "group relative flex h-9 w-full items-center text-sm outline-none transition-colors",
                      "focus-visible:ring-1 focus-visible:ring-primary/40",
                      collapsed ? "justify-center px-0" : "gap-3 pl-3 pr-2.5",
                      onMediaRoute
                        ? "font-medium text-text-main"
                        : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1 left-0 w-0.5 bg-text-main transition-opacity",
                        onMediaRoute ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Images
                      aria-hidden
                      size={ICON_SIZE}
                      strokeWidth={onMediaRoute ? STROKE_ACTIVE : STROKE_IDLE}
                      className={cn(
                        "shrink-0 transition-colors",
                        onMediaRoute ? "text-text-main" : "text-text-muted group-hover:text-text-main"
                      )}
                    />
                    <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate text-left"}>
                      Media Providers
                    </span>
                    {collapsed ? null : (
                      <span className="material-symbols-outlined text-[14px] text-text-subtle transition-transform duration-200">
                        expand_more
                      </span>
                    )}
                  </button>

                  <div
                    inert={mediaExpanded ? undefined : true}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      mediaExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-[15px] border-l border-border pl-1.5">
                        {mediaKinds.map((kind) => (
                          <NavItem
                            key={kind.id}
                            href={`/admin/media-providers/${kind.id}`}
                            label={kind.label}
                            icon={MEDIA_ICONS[kind.id] || Images}
                            nested
                            active={pathname.startsWith(`/admin/media-providers/${kind.id}`)}
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
                </>
              ) : null}

              {group.items.map((item) => {
                const onAccount =
                  pathname === "/admin/account" || pathname.startsWith("/admin/account/");
                const active = item.match
                  ? onAccount && (accountTab || "profile") === item.match
                  : isPathActive(pathname, item.href, item.exact);
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    active={active}
                    onClick={onClose}
                  />
                );
              })}
            </NavGroup>
          ))}
          
          {/* Switch to User View link - for admin to access personal features */}
          <div className={cn("mt-4 border-t border-border pt-4", collapsed ? "px-0" : "px-2")}>
            <Link
              href="/dashboard"
              className={cn(
                "group relative flex h-9 items-center text-sm outline-none transition-colors",
                "focus-visible:ring-1 focus-visible:ring-primary/40",
                collapsed ? "justify-center px-0" : "gap-3 pr-2.5 pl-3",
                "text-primary hover:bg-primary/10"
              )}
            >
              <span className="material-symbols-outlined text-[16px]">person</span>
              <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
                My Dashboard
              </span>
            </Link>
            {!collapsed && (
              <p className="mt-1 px-3 text-[10px] text-text-subtle">
                Access your API keys, usage, and account
              </p>
            )}
          </div>
        </nav>

        {/* Rail foot */}
        <div
          className={cn(
            "flex shrink-0 items-center border-t border-border",
            collapsed ? "flex-col gap-1 py-2" : "h-12 justify-between px-2"
          )}
        >
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <ThemeToggle />
            <HeaderLanguage />
          </div>

          {isDrawer ? null : (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-text-subtle transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden size={15} strokeWidth={STROKE_IDLE} />
              ) : (
                <PanelLeftClose aria-hidden size={15} strokeWidth={STROKE_IDLE} />
              )}
            </button>
          )}
        </div>
      </aside>

      <JumpToPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />

      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title={`Update ${APP_CONFIG.name}`}
        message="Show the install command? You can copy it and shut the server down to install manually."
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          {isUpdating ? (
            <ManualUpdatePanel
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center border border-danger/30 bg-danger/10 text-danger">
                <span className="material-symbols-outlined text-[28px]">power_settings_new</span>
              </div>
              <h2 className="mb-2 font-mono text-xl font-semibold text-white">Server Disconnected</h2>
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

function ManualUpdatePanel({
  installCmd,
  copied,
  onCopyAndShutdown,
  onCancel,
  countdown,
  isDisconnected,
}) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg border border-white/15 bg-[#0a0a0a] p-6 text-white">
      <div className="mb-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-[24px]">download</span>
        <h2 className="font-mono text-lg font-semibold">Manual Update</h2>
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Copy the install command below, then shut down the server to update manually.
      </p>
      <div className="mb-4 rounded-sm border border-white/10 bg-white/5 p-3 font-mono text-sm">
        {installCmd}
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={onCopyAndShutdown}
          disabled={isCountingDown || isDisconnected}
        >
          {isCountingDown ? `Shutting down in ${countdown}s...` : "Copy & Shutdown"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
