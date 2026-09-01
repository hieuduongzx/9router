"use client";

import { Toaster as Sonner } from "sonner";

import { useTheme } from "@/shared/hooks/useTheme";

/**
 * One toast surface for the whole app. Replaces the hand-rolled renderer that
 * was duplicated in both dashboard layouts; `notificationStore` forwards into
 * this, so existing `addNotification` call sites keep working.
 */
function Toaster(props) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme === "system" ? "system" : theme}
      className="toaster group"
      position="top-right"
      closeButton
      richColors={false}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--success-bg": "var(--popover)",
        "--success-text": "var(--success)",
        "--success-border": "var(--border)",
        "--error-bg": "var(--popover)",
        "--error-text": "var(--destructive)",
        "--error-border": "var(--border)",
        "--warning-bg": "var(--popover)",
        "--warning-text": "var(--warning)",
        "--warning-border": "var(--border)",
        "--info-bg": "var(--popover)",
        "--info-text": "var(--info)",
        "--info-border": "var(--border)",
        "--border-radius": "var(--radius-lg)",
      }}
      {...props}
    />
  );
}

export { Toaster };
