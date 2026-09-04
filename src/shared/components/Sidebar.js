"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import PropTypes from "prop-types";
import {
  ChevronDown,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import {
  ADMIN_NAV_GROUPS,
  DASHBOARD_NAV_GROUPS,
  flattenNavForPalette,
  visibleNavItems,
} from "@/shared/constants/dashboardNav";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useSidebarCollapsed } from "@/shared/hooks/useSidebarCollapsed";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import JumpToPalette from "./JumpToPalette";
import HeaderLanguage from "./HeaderLanguage";
import ThemeToggle from "./ThemeToggle";
import { ConfirmModal } from "./Modal";

/**
 * The one dashboard rail, for both the user and admin shells.
 *
 * There used to be two ~600-line sidebars plus a dead third copy, each with its
 * own `NavItem`, group label and update strip. `variant` is the only difference
 * that mattered: which nav groups to read and what the brand row says.
 */
const VARIANTS = {
  user: {
    groups: DASHBOARD_NAV_GROUPS,
    home: "/dashboard",
    brand: APP_CONFIG.name,
    brandIcon: Route,
    navLabel: "Dashboard",
  },
  admin: {
    groups: ADMIN_NAV_GROUPS,
    home: "/admin",
    brand: "Admin Panel",
    brandIcon: ShieldCheck,
    navLabel: "Admin dashboard",
  },
};

function isPathActive(pathname, href, exact = false) {
  // Strip the query so a `?tab=` row still matches its own pathname.
  const base = href.split("?")[0];
  if (exact) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavRow({
  as: Comp = Link,
  label,
  icon: ItemIcon,
  active,
  collapsed,
  nested = false,
  trailing,
  className,
  ...props
}) {
  const row = (
    <Comp
      aria-current={active && Comp === Link ? "page" : undefined}
      className={cn(
        "group relative flex h-9 w-full items-center rounded-md text-sm outline-none transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        collapsed ? "justify-center px-0" : cn("gap-2.5 pr-2", nested ? "pl-2" : "pl-2.5"),
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {ItemIcon ? (
        <ItemIcon
          aria-hidden
          className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")}
        />
      ) : null}
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate text-left"}>{label}</span>
      {collapsed ? null : trailing}
    </Comp>
  );

  // Collapsed to 64px the label is `sr-only`, so a tooltip is the only way to
  // read a row without expanding the rail.
  if (!collapsed) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function GroupLabel({ children, collapsed }) {
  if (collapsed) {
    return (
      <div className="px-3 pb-1 pt-3">
        <Separator />
      </div>
    );
  }
  return (
    <p className="px-2.5 pb-1 pt-4 text-xs font-medium text-muted-foreground/80">{children}</p>
  );
}

/** A nav item with children: a disclosure, not a destination. */
function NavSubmenu({ item, pathname, collapsed, onNavigate, onExpandRail }) {
  const sectionActive = isPathActive(pathname, item.href);
  const [open, setOpen] = useState(sectionActive);
  const [lastActive, setLastActive] = useState(sectionActive);

  // Navigating into the section opens it; done during render so the panel is
  // already open on the first paint after a route change.
  if (sectionActive !== lastActive) {
    setLastActive(sectionActive);
    if (sectionActive) setOpen(true);
  }

  const expanded = open && !collapsed;

  return (
    <>
      <NavRow
        as="button"
        type="button"
        label={item.label}
        icon={item.icon}
        active={sectionActive}
        collapsed={collapsed}
        aria-expanded={expanded}
        onClick={() => {
          // A nested list has nowhere to render at 64px, so opening it has to
          // expand the rail first.
          if (collapsed) {
            onExpandRail();
            setOpen(true);
            return;
          }
          setOpen((value) => !value);
        }}
        trailing={
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        }
      />
      <div
        inert={expanded ? undefined : true}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-[19px] border-l pl-1.5">
            {item.children.map((child) => (
              <NavRow
                key={child.href}
                href={child.href}
                label={child.label}
                icon={child.icon}
                nested
                active={isPathActive(pathname, child.href)}
                onClick={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ variant = "user", onClose }) {
  const config = VARIANTS[variant] || VARIANTS.user;
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const accountTab = searchParams?.get("tab") || "profile";

  // Which shell is mounted *is* the answer: `/admin/*` is only reachable with an
  // admin session (dashboardGuard). This used to be re-derived from an
  // `/api/auth/status` fetch that was never repeated on navigation, so the rail
  // could disagree with the layout it was rendered in and silently drop rows.
  const isAdmin = variant === "admin";

  const [enableTranslator, setEnableTranslator] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const { copied, copy } = useCopyToClipboard(2000);
  const [storedCollapsed, setCollapsed] = useSidebarCollapsed();

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;
  const isDrawer = Boolean(onClose);
  // The mobile drawer is always full width — collapsing it makes no sense.
  const collapsed = storedCollapsed && !isDrawer;

  const navGroups = useMemo(
    () =>
      config.groups
        .map((group) => ({
          ...group,
          items: visibleNavItems(group.items, { isAdmin, enableTranslator }),
        }))
        .filter((group) => group.items.length > 0),
    [config.groups, isAdmin, enableTranslator],
  );

  const paletteItems = useMemo(() => flattenNavForPalette(navGroups), [navGroups]);

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

  // Only the admin rail has a translator-gated row, so only it needs settings.
  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    fetch("/api/settings", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (settings?.enableTranslator) setEnableTranslator(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasUpdate) setUpdateInfo(data);
      })
      .catch(() => {});
  }, []);

  const handleCopyAndShutdown = async () => {
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

  const BrandIcon = config.brandIcon;

  return (
    <>
      <aside
        className={cn(
          "flex h-full min-h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b",
            collapsed ? "justify-center px-0" : "gap-2 px-3",
          )}
        >
          <Link
            href={config.home}
            onClick={onClose}
            className={cn(
              "flex items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              collapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5 px-1 py-1.5",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BrandIcon aria-hidden className="size-4" />
            </span>
            <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate font-semibold"}>
              {config.brand}
            </span>
          </Link>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close sidebar"
              className="shrink-0 lg:hidden"
            >
              <X />
            </Button>
          ) : null}
        </div>

        <div className={cn("shrink-0 border-b", collapsed ? "flex justify-center py-2.5" : "p-2.5")}>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Jump to page"
            aria-label="Jump to page"
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(
              "flex items-center rounded-md border bg-background text-muted-foreground shadow-xs transition-colors",
              "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              collapsed ? "size-8 justify-center" : "h-8 w-full gap-2 px-2.5",
            )}
          >
            <Search aria-hidden className="size-3.5 shrink-0" />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-sm">Jump to...</span>
                <kbd className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        {updateInfo ? (
          <div className={cn("shrink-0 border-b bg-muted/40", collapsed ? "flex justify-center py-2.5" : "p-2.5")}>
            {collapsed ? (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setShowUpdateModal(true)}
                aria-label="Update available"
                title="Update available"
              >
                <Download />
              </Button>
            ) : (
              <>
                {/* Deliberately no version number — see DESIGN.md. */}
                <p className="text-sm font-medium">A newer release is available</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button size="xs" onClick={() => setShowUpdateModal(true)}>
                    <Download />
                    Update
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copy(INSTALL_CMD)}
                    title={INSTALL_CMD}
                  >
                    {copied ? "Copied" : "Command"}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <nav
          aria-label={config.navLabel}
          className={cn(
            "custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-4",
            collapsed ? "px-2" : "px-2",
          )}
        >
          {navGroups.map((group) => (
            <div key={group.id}>
              <GroupLabel collapsed={collapsed}>{group.label}</GroupLabel>
              {group.items.map((item) =>
                item.children?.length ? (
                  <NavSubmenu
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onClose}
                    onExpandRail={() => setCollapsed(false)}
                  />
                ) : (
                  <NavRow
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    // `match` rows are one page differing only by `?tab=`, so
                    // the active row is decided by the query, not the path.
                    active={
                      item.match
                        ? isPathActive(pathname, item.href) && accountTab === item.match
                        : isPathActive(pathname, item.href, item.exact)
                    }
                    onClick={onClose}
                  />
                ),
              )}
            </div>
          ))}
        </nav>

        <div
          className={cn(
            "flex shrink-0 items-center border-t",
            collapsed ? "flex-col gap-1 py-2" : "h-12 justify-between px-2",
          )}
        >
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <ThemeToggle />
            <HeaderLanguage />
          </div>
          {isDrawer ? null : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
        </div>
      </aside>

      <JumpToPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={() => {
          setShowUpdateModal(false);
          setIsUpdating(true);
        }}
        title={`Update ${APP_CONFIG.name}`}
        message="Show the install command? You can copy it and shut the server down to install manually."
        confirmText="Show command"
        variant="primary"
      />

      {isUpdating || isDisconnected ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6">
          {isUpdating ? (
            <ManualUpdatePanel
              installCmd={INSTALL_CMD}
              copied={copied}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={() => {
                setIsUpdating(false);
                setShutdownCountdown(0);
              }}
            />
          ) : (
            <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-lg">
              <p className="font-semibold">Server disconnected</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The proxy server has been stopped.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => globalThis.location.reload()}
              >
                Reload page
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

Sidebar.propTypes = {
  variant: PropTypes.oneOf(["user", "admin"]),
  onClose: PropTypes.func,
};

function ManualUpdatePanel({
  installCmd,
  copied,
  countdown,
  isDisconnected,
  onCopyAndShutdown,
  onCancel,
}) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg">
      <p className="font-semibold">Manual update</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Copy the install command, then shut the server down to update.
      </p>
      <div className="terminal-block mt-4 overflow-x-auto p-3">
        <span className="terminal-prompt">$ </span>
        {installCmd}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={onCopyAndShutdown} disabled={isCountingDown || isDisconnected}>
          {isCountingDown ? `Shutting down in ${countdown}s...` : copied ? "Copied" : "Copy & shut down"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isCountingDown}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
