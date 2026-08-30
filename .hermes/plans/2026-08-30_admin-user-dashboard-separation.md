# Tách Dashboard User và Admin - Kế hoạch Triển khai

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Tách biệt hoàn toàn sidebar và trang dashboard giữa User và Admin — User thấy sidebar riêng, Admin có dashboard riêng với đầy đủ quyền quản trị.

**Architecture:** 
- Tạo route group mới `/admin` cho admin dashboard
- Sidebar hiện tại chuyển thành sidebar user-only (loại bỏ `admin: true` items)
- Tạo AdminSidebar mới cho admin dashboard
- DashboardLayout hiện tại refactor để hỗ trợ cả hai layout

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Lucide icons

---

## Phân tích hiện trạng

### Hệ thống phân quyền hiện tại:
1. **dashboardView.js** - Cookie-based view mode (admin/user) cho phép admin chuyển đổi giữa 2 chế độ
2. **dashboardGuard.js** - Middleware bảo vệ routes:
   - `ACCOUNT_DASHBOARD_PATHS`: User-safe routes (api-keys, usage, models, account, token-saver)
   - `ADMIN_API_PREFIXES`: Admin-only API endpoints
   - Non-admin users bị redirect về `/dashboard` khi truy cập admin routes
3. **Sidebar.js** - Hiện tại dùng `visibleNavItems()` lọc items dựa trên `isAdmin` state
4. **Header.js** - Có `DashboardViewToggle` cho admin chuyển giữa admin/user view

### Vấn đề hiện tại:
- Admin và User dùng chung 1 sidebar, chỉ khác nhau qua filter
- Admin phải toggle giữa 2 chế độ để xem different views
- Không có sự tách biệt rõ ràng giữa 2 hệ thống

---

## Kế hoạch triển khai

### Task 1: Tạo Admin Layout và Route Group

**Objective:** Tạo `/admin` route group với layout riêng cho admin dashboard

**Files:**
- Create: `src/app/(admin)/admin/layout.js`
- Create: `src/app/(admin)/admin/page.js`

**Step 1: Tạo admin layout**

```jsx
// src/app/(admin)/admin/layout.js
"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import { useSidebarCollapsed } from "@/shared/hooks/useSidebarCollapsed";
import AdminSidebar from "@/shared/components/admin/AdminSidebar";
import Header from "@/shared/components/Header";

function getToastStyle(type) {
  if (type === "success") {
    return {
      wrapper: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
      icon: "check_circle",
    };
  }
  if (type === "error") {
    return {
      wrapper: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      icon: "error",
    };
  }
  if (type === "warning") {
    return {
      wrapper: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: "warning",
    };
  }
  return {
    wrapper: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: "info",
  };
}

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const [sidebarCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <div className="fixed top-4 right-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
        {notifications.map((n) => {
          const style = getToastStyle(n.type);
          return (
            <div
              key={n.id}
              className={`rounded-sm border px-3 py-2 ${style.wrapper}`}
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] leading-5">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  {n.title ? <p className="text-xs font-semibold mb-0.5">{n.title}</p> : null}
                  <p className="text-xs whitespace-pre-wrap break-words">{n.message}</p>
                </div>
                {n.dismissible ? (
                  <button
                    type="button"
                    onClick={() => removeNotification(n.id)}
                    className="text-current/70 hover:text-current"
                    aria-label="Dismiss notification"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Admin Sidebar - Desktop */}
      <div className="hidden h-full lg:flex">
        <Suspense
          fallback={
            <div
              className={`h-full shrink-0 border-r border-border bg-sidebar ${
                sidebarCollapsed ? "w-16" : "w-64"
              }`}
            />
          }
        >
          <AdminSidebar />
        </Suspense>
      </div>

      {/* Admin Sidebar - Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Suspense fallback={null}>
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </Suspense>
      </div>

      {/* Main content */}
      <main className="flex h-full min-w-0 flex-1 flex-col">
        <Header key={pathname} onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Tạo admin dashboard page**

```jsx
// src/app/(admin)/admin/page.js
import AdminDashboardClient from "./AdminDashboardClient";

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
```

**Step 3: Verify**
- File exists: `src/app/(admin)/admin/layout.js`
- File exists: `src/app/(admin)/admin/page.js`

---

### Task 2: Tạo AdminSidebar Component

**Objective:** Tạo AdminSidebar với đầy đủ tính năng quản trị

**Files:**
- Create: `src/shared/components/admin/AdminSidebar.js`

**Step 1: Tạo AdminSidebar với full admin navigation**

```jsx
// src/shared/components/admin/AdminSidebar.js
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Boxes,
  ChartColumn,
  Coins,
  Gauge,
  GitFork,
  House,
  KeyRound,
  Languages,
  Lock,
  Network,
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

// Admin navigation groups - full access
const ADMIN_NAV_GROUPS = [
  {
    id: "pinned",
    label: "Pinned",
    items: [
      { href: "/admin", label: "Dashboard", icon: House, exact: true },
      { href: "/admin/providers", label: "Providers", icon: Server },
      { href: "/admin/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    id: "traffic",
    label: "Traffic",
    items: [
      { href: "/admin/usage", label: "Usage", icon: ChartColumn },
      { href: "/admin/activity", label: "Activity", icon: Activity },
      { href: "/ranking", label: "Model Ranking", icon: Trophy },
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
      { href: "/admin/token-saver", label: "Token Saver", icon: Coins },
      { href: "/admin/translator", label: "Translator", icon: Languages },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/users", label: "Accounts", icon: Users },
      { href: "/admin/quota", label: "Quota", icon: Gauge },
      { href: "/admin/proxy-pools", label: "Proxy Pools", icon: Network },
      { href: "/admin/console-log", label: "Console Log", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: "/admin/account", label: "Profile", icon: User, exact: true, match: "profile" },
      { href: "/admin/account?tab=wallet", label: "Wallet", icon: Wallet, match: "wallet" },
      { href: "/admin/account?tab=security", label: "Security", icon: Lock, match: "security" },
    ],
  },
];

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

  const navGroups = useMemo(() => ADMIN_NAV_GROUPS, []);

  const paletteItems = useMemo(() => {
    return navGroups.flatMap((group) =>
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        group: group.label,
        icon: item.icon,
      }))
    );
  }, [navGroups]);

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
            title={collapsed ? APP_CONFIG.name : undefined}
            className={cn(
              "group flex items-center outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
              collapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5 px-1 py-1.5"
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center border border-border text-text-main transition-colors group-hover:border-text-main">
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
              {group.items.map((item) => {
                const isActive = item.href === "/admin"
                  ? pathname === "/admin" || pathname === "/admin/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive}
                    onClick={onClose}
                    collapsed={collapsed}
                  />
                );
              })}
            </NavGroup>
          ))}
        </nav>

        {/* Bottom utilities */}
        <div className={cn("shrink-0 border-t border-border", collapsed ? "px-0 py-2" : "px-2 py-2")}>
          <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "justify-between")}>
            <HeaderLanguage collapsed={collapsed} />
            <ThemeToggle collapsed={collapsed} />
            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex size-8 items-center justify-center text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                aria-label="Collapse sidebar"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
            )}
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex size-8 items-center justify-center text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                aria-label="Expand sidebar"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Jump to palette */}
      <JumpToPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />

      {/* Update modal */}
      <ConfirmModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update Available"
        description="A newer version is available. Update now?"
        confirmLabel="Update"
      />
    </>
  );
}
```

**Step 2: Verify**
- File exists: `src/shared/components/admin/AdminSidebar.js`

---

### Task 3: Refactor User Sidebar (Loại bỏ admin items)

**Objective:** Đổi tên file hiện tại thành UserSidebar, loại bỏ các admin-only items

**Files:**
- Rename: `src/shared/components/Sidebar.js` → `src/shared/components/UserSidebar.js`
- Modify: `src/shared/constants/dashboardNav.js`

**Step 1: Sửa dashboardNav.js - Loại bỏ admin flag, giữ lại user items**

```javascript
// src/shared/constants/dashboardNav.js
import {
  ChartColumn,
  Coins,
  House,
  KeyRound,
  Trophy,
  User,
  Users,
  Wallet,
  Lock,
} from "lucide-react";

/**
 * User dashboard navigation - simplified for non-admin users.
 * Admin items have been moved to admin dashboard.
 */
export const DASHBOARD_NAV_GROUPS = [
  {
    id: "pinned",
    label: "Pinned",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: House, exact: true },
      { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    id: "traffic",
    label: "Traffic",
    items: [
      { href: "/dashboard/usage", label: "Usage", icon: ChartColumn },
      { href: "/ranking", label: "Model Ranking", icon: Trophy },
      { href: "/dashboard/models", label: "Models", icon: Users },
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    items: [
      { href: "/dashboard/token-saver", label: "Token Saver", icon: Coins },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: "/dashboard/account", label: "Profile", icon: User, exact: true, match: "profile" },
      { href: "/dashboard/account?tab=wallet", label: "Wallet", icon: Wallet, match: "wallet" },
      { href: "/dashboard/account?tab=security", label: "Security", icon: Lock, match: "security" },
    ],
  },
];

/**
 * Rows visible for the current viewer — simplified for user-only view.
 */
export function visibleNavItems(items, { isAdmin, enableTranslator }) {
  return items.filter((item) => {
    // Admin items are no longer in user sidebar
    if (item.admin && !isAdmin) return false;
    if (item.requiresTranslator && !enableTranslator) return false;
    return true;
  });
}
```

**Step 2: Rename Sidebar.js to UserSidebar.js**

Rename the file and update exports. The component logic stays mostly the same but removes admin-specific UI elements.

**Step 3: Verify**
- File renamed: `src/shared/components/UserSidebar.js`
- DashboardNav updated with user-only items

---

### Task 4: Cập nhật Dashboard Layout sử dụng UserSidebar

**Objective:** Dashboard layout hiện tại dùng UserSidebar thay vì Sidebar

**Files:**
- Modify: `src/shared/components/layouts/DashboardLayout.js`

**Step 1: Sửa import trong DashboardLayout**

```javascript
// Thay thế
import Sidebar from "../Sidebar";
// Thành
import UserSidebar from "../UserSidebar";
```

**Step 2: Thay thế Sidebar component**

Tìm và thay thế tất cả `<Sidebar` thành `<UserSidebar` trong file.

**Step 3: Verify**
- DashboardLayout.js import UserSidebar
- Tất cả sidebar references đã được cập nhật

---

### Task 5: Tạo Admin Dashboard Client Component

**Objective:** Tạo trang dashboard chính cho admin với thống kê tổng quan

**Files:**
- Create: `src/app/(admin)/admin/AdminDashboardClient.js`

**Step 1: Tạo AdminDashboardClient.js**

Component này sẽ hiển thị:
- Tổng quan hệ thống (tổng users, tổng requests, tổng cost)
- Biểu đồ usage system-wide
- Danh sách providers đang hoạt động
- Quick actions cho admin

(Xem chi tiết implementation trong file thực tế)

**Step 2: Verify**
- File exists: `src/app/(admin)/admin/AdminDashboardClient.js`

---

### Task 6: Tạo API Routes cho Admin Dashboard

**Objective:** Tạo các API endpoints mới cho admin dashboard

**Files:**
- Create: `src/app/api/admin/stats/route.js`
- Create: `src/app/api/admin/overview/route.js`

**Step 1: Tạo admin stats API**

```javascript
// src/app/api/admin/stats/route.js
import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getSettings, getUsageStats } from "@/lib/localDb";

export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    if (account?.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    // Lấy thống kê system-wide
    const stats = await getUsageStats({ period: "24h", scope: "system" });
    
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to load admin stats" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify**
- API route exists and returns correct data

---

### Task 7: Cập nhật Middleware cho Admin Routes

**Objective:** Middleware cần xử lý admin routes đúng cách

**Files:**
- Modify: `src/dashboardGuard.js`

**Step 1: Thêm admin dashboard paths**

Tìm `ACCOUNT_DASHBOARD_PATHS` và thêm:

```javascript
const ADMIN_DASHBOARD_PATHS = [
  "/admin",
  "/admin/providers",
  "/admin/api-keys",
  "/admin/usage",
  "/admin/activity",
  "/admin/combos",
  "/admin/models",
  "/admin/skills",
  "/admin/cli-tools",
  "/admin/token-saver",
  "/admin/translator",
  "/admin/users",
  "/admin/quota",
  "/admin/proxy-pools",
  "/admin/console-log",
  "/admin/settings",
  "/admin/account",
];
```

**Step 2: Sửa middleware protection logic**

Thêm logic để admin routes chỉ accessible bởi admin users.

**Step 3: Verify**
- Admin routes protected
- Non-admin users redirect appropriately

---

### Task 8: Cập nhật Header cho Admin Dashboard

**Objective:** Header trong admin dashboard hiển thị thông tin admin

**Files:**
- Modify: `src/shared/components/Header.js`

**Step 1: Thêm logic detect admin route**

```javascript
// Thêm ở đầu component
const isAdminRoute = pathname.startsWith("/admin");
```

**Step 2: Sửa viewMode logic**

Trong admin dashboard, không cần toggle view mode vì admin đã ở trong admin area.

**Step 3: Verify**
- Header hoạt động đúng trong cả admin và user dashboard

---

### Task 9: Di chuyển Admin Pages sang Admin Route

**Objective:** Di chuyển các trang admin-only sang `/admin` route

**Files:**
- Create: `src/app/(admin)/admin/providers/page.js`
- Create: `src/app/(admin)/admin/users/page.js`
- Create: `src/app/(admin)/admin/settings/page.js`
- (Và các trang admin khác)

**Step 1: Tạo wrapper pages cho admin**

Mỗi trang admin sẽ import component từ vị trí hiện tại và wrap trong admin layout.

Ví dụ:
```jsx
// src/app/(admin)/admin/providers/page.js
import ProvidersClient from "@/app/(dashboard)/dashboard/providers/ProvidersClient";

export default function AdminProvidersPage() {
  return <ProvidersClient />;
}
```

**Step 2: Verify**
- Tất cả admin pages accessible qua `/admin/*`
- User pages vẫn hoạt động tại `/dashboard/*`

---

### Task 10: Cập nhật Navigation Links

**Objective:** Đảm bảo tất cả internal links trỏ đúng route

**Files:**
- Modify: Various files containing navigation links

**Step 1: Tìm và sửa links**

Sử dụng grep để tìm tất cả links đến admin routes và cập nhật.

**Step 2: Verify**
- Không có broken links
- Tất cả admin links trỏ đến `/admin/*`

---

### Task 11: Testing và Validation

**Objective:** Kiểm tra toàn bộ hệ thống hoạt động đúng

**Step 1: Test User Dashboard**
- Đăng nhập với user account
- Kiểm tra sidebar chỉ hiển thị user items
- Kiểm tra không thể truy cập admin routes

**Step 2: Test Admin Dashboard**
- Đăng nhập với admin account
- Kiểm tra có thể chuyển sang admin dashboard
- Kiểm tra admin sidebar hiển thị đầy đủ items
- Kiểm tra admin có thể truy cập tất cả admin routes

**Step 3: Test View Mode Toggle**
- Admin có thể toggle giữa admin và user view
- User view hiển thị đúng user sidebar

**Step 4: Verify**
- Tất cả tests pass
- Không có regressions

---

## Files Summary

### New Files:
1. `src/app/(admin)/admin/layout.js`
2. `src/app/(admin)/admin/page.js`
3. `src/app/(admin)/admin/AdminDashboardClient.js`
4. `src/shared/components/admin/AdminSidebar.js`
5. `src/app/api/admin/stats/route.js`
6. `src/app/api/admin/overview/route.js`
7. `src/app/(admin)/admin/providers/page.js`
8. `src/app/(admin)/admin/users/page.js`
9. `src/app/(admin)/admin/settings/page.js`
10. (Các admin page wrapper khác)

### Modified Files:
1. `src/shared/constants/dashboardNav.js`
2. `src/shared/components/Sidebar.js` → renamed to `UserSidebar.js`
3. `src/shared/components/layouts/DashboardLayout.js`
4. `src/shared/components/Header.js`
5. `src/dashboardGuard.js`

---

## Risks & Tradeoffs

1. **Breaking changes**: Cần đảm bảo backward compatibility cho existing users
2. **Performance**: Thêm admin routes có thể tăng bundle size nhẹ
3. **SEO**: Không quan trọng vì đây là SPA dashboard

---

## Open Questions

1. Admin có cần thấy user dashboard khi toggle không? → Có, giữ toggle functionality
2. Có cần redirect `/dashboard` → `/admin` cho admin không? → Không, giữ cả hai routes
3. Legacy password protection cần xử lý thế nào? → Giữ nguyên logic hiện tại

---

**Plan complete and saved to: `.hermes/plans/2026-08-30_admin-user-dashboard-separation.md`**

Ready to execute using subagent-driven-development skill — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
