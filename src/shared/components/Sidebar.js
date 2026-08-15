"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AudioLines,
  Braces,
  Brush,
  Check,
  ChevronDown,
  Copy,
  Download,
  Film,
  Globe,
  Images,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PowerOff,
  Route,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { DASHBOARD_NAV_GROUPS, visibleNavItems } from "@/shared/constants/dashboardNav";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useSidebarCollapsed } from "@/shared/hooks/useSidebarCollapsed";
import AccountMenu from "./AccountMenu";
import Button from "./Button";
import JumpToPalette from "./JumpToPalette";
import { ConfirmModal } from "./Modal";

/**
 * Lucide strokes are authored on a 24px grid, so a 16px icon renders them at
 * strokeWidth * (16/24): idle 2.25 lands on ~1.5px, active 2.75 on ~1.83px.
 * Kept deliberately above Lucide's default of 2 because at this size the thinner
 * weights read as washed out against muted text. The active row gains weight
 * rather than a fill, since Lucide has no filled variant to switch to.
 */
const ICON_SIZE = 16;
const STROKE_IDLE = 2.25;
const STROKE_ACTIVE = 2.75;
/** Same optical weight for the 13px icons in the update strip: 1.5px * 24/13. */
const STROKE_SMALL = 2.75;

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];

/** Media submenu icons, keyed by kind id (the constants carry webfont names). */
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
  href: "/dashboard/media-providers/web",
};

function isPathActive(pathname, href, exact = false) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared row geometry: square corners, 2px ink tick when active.
 *
 * Labels are sans, not mono: DESIGN.md's Mono-Structure Rule puts nav labels in
 * mono, but at 14px in a narrow rail mono is measurably harder to scan, so the
 * rule is waived here by user decision. Mono stays on identifiers (version) and
 * the structural eyebrows.
 *
 * Marks a row the member view never renders. Only administrators ever see this
 * tag, so it reads as "hidden from your users" rather than as a lock.
 */

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

function NavItem({ href, label, icon: Icon, active, onClick, nested = false, collapsed = false, adminOnly = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={adminOnly ? `${label} — admin only` : label}
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
      {/* Collapsed rows keep an accessible name even with the label hidden. */}
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
        {label}
        {adminOnly && <span className="sr-only"> (admin only)</span>}
      </span>
      {!collapsed && adminOnly && <AdminTag />}
    </Link>
  );
}

NavItem.propTypes = {
  href: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  nested: PropTypes.bool,
  collapsed: PropTypes.bool,
  adminOnly: PropTypes.bool,
};

/**
 * `LABEL ────` eyebrow with the trailing hairline rule (see DESIGN.md).
 * Collapsed, the text is dropped and only the rule remains as a group seam.
 */
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

GroupLabel.propTypes = { children: PropTypes.node, collapsed: PropTypes.bool };

function NavGroup({ label, children, collapsed }) {
  return (
    <div>
      <GroupLabel collapsed={collapsed}>{label}</GroupLabel>
      {children}
    </div>
  );
}

NavGroup.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  collapsed: PropTypes.bool,
};

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountTab = searchParams?.get("tab") || "profile";
  const onMediaRoute = pathname.startsWith("/dashboard/media-providers");
  const [mediaOpen, setMediaOpen] = useState(onMediaRoute);
  const [lastMediaRoute, setLastMediaRoute] = useState(onMediaRoute);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [account, setAccount] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);
  const [storedCollapsed, setCollapsed] = useSidebarCollapsed();

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  // `onClose` is only passed by the mobile drawer, which is always full width —
  // collapsing there would leave a rail floating over the overlay.
  const isDrawer = Boolean(onClose);
  const collapsed = storedCollapsed && !isDrawer;
  const mediaExpanded = mediaOpen && !collapsed;

  /** Collapsed rows have no room for a submenu, so open the rail first. */
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

  const navGroups = useMemo(
    () => DASHBOARD_NAV_GROUPS
      .map((group) => ({
        ...group,
        items: visibleNavItems(group.items, { isAdmin, enableTranslator }),
      }))
      // "Capabilities" still renders for admins on the strength of the media
      // submenu alone, which is not part of the item list.
      .filter((group) => group.items.length > 0 || (group.id === "capabilities" && isAdmin)),
    [isAdmin, enableTranslator]
  );

  /** Same destinations as the rail, flattened for the ⌘K navigator. */
  const paletteItems = useMemo(() => {
    const rows = navGroups.flatMap((group) =>
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        group: group.label,
        icon: item.icon,
      }))
    );
    if (!isAdmin) return rows;
    const media = [
      ...mediaKinds.map((kind) => ({
        href: `/dashboard/media-providers/${kind.id}`,
        label: kind.label,
        group: "Media",
        icon: MEDIA_ICONS[kind.id] || Images,
      })),
      { href: COMBINED_WEB_ITEM.href, label: COMBINED_WEB_ITEM.label, group: "Media", icon: COMBINED_WEB_ITEM.icon },
    ];
    return [...rows, ...media];
  }, [navGroups, isAdmin, mediaKinds]);

  // ⌘K / Ctrl+K opens the navigator from anywhere in the dashboard. Bound on the
  // desktop rail only — the drawer instance would double-register the shortcut.
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

  // Auto-reveal the media group when routing into it; a manual collapse still wins afterwards.
  // Adjusted during render (not in an effect) so it never causes a cascading re-render.
  if (onMediaRoute !== lastMediaRoute) {
    setLastMediaRoute(onMediaRoute);
    if (onMediaRoute) setMediaOpen(true);
  }

  // One auth read serves both the nav gating and the account row at the foot of
  // the rail, so moving the profile out of the header cost no extra request.
  useEffect(() => {
    const loadAuthStatus = () =>
      fetch("/api/auth/status", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          const admin = data.isAdminView === true;
          setIsAdmin(admin);
          setAccount({
            displayName: data?.displayName || data?.oidcName || data?.oidcEmail || "",
            role: data?.role || "",
            creditCents: Number.isSafeInteger(data?.user?.creditCents) ? data.user.creditCents : null,
          });
          if (!admin) return null;
          return fetch("/api/settings")
            .then((res) => (res.ok ? res.json() : null))
            .then((settings) => {
              if (settings?.enableTranslator) setEnableTranslator(true);
            });
        })
        .catch(() => {});

    loadAuthStatus();
    window.addEventListener("account-profile-updated", loadAuthStatus);
    return () => window.removeEventListener("account-profile-updated", loadAuthStatus);
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

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) window.location.assign("/login");
    } catch (err) {
      console.error("Failed to logout:", err);
    }
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
            href="/dashboard"
            onClick={onClose}
            title={collapsed ? APP_CONFIG.name : undefined}
            className={cn(
              "group flex items-center outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
              collapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5 px-1 py-1.5"
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center border border-border text-text-main transition-colors group-hover:border-text-main">
              <Route aria-hidden size={16} strokeWidth={STROKE_ACTIVE} />
            </span>
            <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
              <span className="block truncate font-mono text-sm font-semibold tracking-tight text-text-main">
                {APP_CONFIG.name}
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
              <X aria-hidden size={16} strokeWidth={STROKE_IDLE} />
            </button>
          ) : null}
        </div>

        {/* ⌘K navigator trigger */}
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
            <Search aria-hidden size={13} strokeWidth={STROKE_IDLE} className="shrink-0" />
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


        {/* Update strip — collapses to a single affordance so the notice survives */}
        {isAdmin && updateInfo && collapsed ? (
          <div className="flex shrink-0 justify-center border-b border-border bg-surface-2/40 py-2.5">
            <button
              type="button"
              onClick={() => setShowUpdateModal(true)}
              title="Update available"
              aria-label="Update available"
              className="flex size-8 items-center justify-center rounded-sm border border-border text-text-main transition-colors hover:bg-surface-2"
            >
              <Download aria-hidden size={15} strokeWidth={STROKE_IDLE} />
            </button>
          </div>
        ) : null}

        {isAdmin && updateInfo && !collapsed ? (
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
                <Download aria-hidden size={13} strokeWidth={STROKE_SMALL} />
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
                  <Check aria-hidden size={13} strokeWidth={STROKE_SMALL} />
                ) : (
                  <Copy aria-hidden size={13} strokeWidth={STROKE_SMALL} />
                )}
                {copied ? "Copied" : "Command"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <nav
          aria-label="Dashboard"
          className={cn(
            "custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-4",
            collapsed ? "px-0" : "px-2"
          )}
        >
          {navGroups.map((group) => (
            <NavGroup key={group.id} label={group.label} collapsed={collapsed}>
              {/* Media sits at the head of Capabilities: it is the only row with
                  children, and a submenu reads better before flat siblings. */}
              {group.id === "capabilities" && isAdmin ? (
                <>
                  <button
                  type="button"
                  onClick={handleMediaToggle}
                  aria-expanded={collapsed ? false : mediaOpen}
                  title="Media Providers — admin only"
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
                    <span className="sr-only"> (admin only)</span>
                  </span>
                  {collapsed ? null : <AdminTag />}
                  {collapsed ? null : (
                    <ChevronDown
                      aria-hidden
                      size={14}
                      strokeWidth={STROKE_IDLE}
                      className={cn(
                        "shrink-0 text-text-subtle transition-transform duration-200",
                        mediaOpen && "rotate-180"
                      )}
                    />
                  )}
                </button>

                {/* `inert` keeps Tab out of the collapsed rows — clipping them with
                    overflow-hidden alone leaves them focusable but invisible. */}
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
                          href={`/dashboard/media-providers/${kind.id}`}
                          label={kind.label}
                          icon={MEDIA_ICONS[kind.id] || Images}
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
                </>
              ) : null}

              {group.items.map((item) => {
                // Account rows all share one route and differ by ?tab=, so they
                // cannot be resolved by pathname alone.
                const onAccount =
                  pathname === "/dashboard/account" || pathname.startsWith("/dashboard/account/");
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
                    adminOnly={item.admin === true}
                    onClick={onClose}
                  />
                );
              })}
            </NavGroup>
          ))}
        </nav>

        {/* Account row + rail toggle — the profile lives at the foot of the rail,
            not in the page header. */}
        <div
          className={cn(
            "h-12 shrink-0 border-t border-border",
            collapsed ? "flex flex-col items-center justify-center gap-2" : "flex items-center gap-1 px-2"
          )}
        >

          <AccountMenu
            displayName={account?.displayName}
            role={account?.role}
            creditCents={account?.creditCents}
            collapsed={collapsed}
            onLogout={handleLogout}
            onNavigate={onClose}
          />

          {/* Drawer mode is always full width, so the rail toggle is desktop-only. */}
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
                <PowerOff aria-hidden size={28} strokeWidth={2} />
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

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

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
        <div className="flex size-11 shrink-0 items-center justify-center border border-white/15 text-white">
          <Copy aria-hidden size={20} strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-mono text-lg font-semibold">Update {APP_CONFIG.name}</h2>
          <p className="text-xs text-white/60">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="section-label mb-2 !text-white/50">Install command</p>
      <div className="mb-4 w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2">
        <code className="break-all font-mono text-xs text-emerald-400">{installCmd}</code>
      </div>

      <ol className="mb-4 list-inside list-decimal space-y-1 text-xs text-white/70">
        <li>
          Click <strong>Copy &amp; Shutdown</strong> below.
        </li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>
          Run{" "}
          <code className="rounded-sm bg-white/10 px-1 text-emerald-400">9router</code> again after
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
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
