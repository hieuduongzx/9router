"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Linear-style toast notification
function Toast({ notification, onDismiss }) {
  const styles = {
    success: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
    error: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    warning: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    info: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 shadow-lg flex items-start gap-2 animate-slide-up",
        styles[notification.type] || styles.info
      )}
    >
      <span className="text-sm leading-5">{icons[notification.type] || icons.info}</span>
      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className="text-sm font-medium leading-5 mb-0.5">{notification.title}</p>
        )}
        <p className="text-sm leading-5 whitespace-pre-wrap break-words opacity-90">
          {notification.message}
        </p>
      </div>
      {notification.dismissible && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 -mr-1 -mt-0.5 opacity-60 hover:opacity-100"
          onClick={() => onDismiss(notification.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function AppLayout({ children, notifications = [], onDismissNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Toast Notifications - Linear style positioning */}
      <div className="fixed top-4 right-4 z-[80] flex w-[min(92vw,320px)] flex-col gap-2">
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={onDismissNotification} />
        ))}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Sidebar - Mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex flex-col flex-1 h-full min-w-0 relative">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <div
          className={cn(
            "flex-1 overflow-y-auto bg-background",
            pathname === "/dashboard/basic-chat" ? "" : "p-5"
          )}
        >
          <div
            className={cn(
              pathname === "/dashboard/basic-chat"
                ? "flex-1 w-full h-full flex flex-col"
                : "max-w-7xl mx-auto"
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
