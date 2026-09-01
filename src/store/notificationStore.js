/**
 * Notification store — the app's toast API.
 *
 * The queue and the renderer used to live here and in both dashboard layouts
 * (duplicated). Sonner owns presentation, stacking, timers and swipe-dismiss
 * now, so this file is a thin façade that keeps the existing
 * `notify.success(...)` call sites working unchanged. `<Toaster />` is mounted
 * once in the root layout.
 */

import { create } from "zustand";
import { toast } from "sonner";

/** Errors stay up longer — they usually carry a reason worth reading. */
const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 8000;

function show(kind, { message, title, duration, dismissible }) {
  const fn = toast[kind] || toast;
  return fn(title || message, {
    description: title ? message : undefined,
    duration: duration ?? (kind === "error" ? ERROR_DURATION : DEFAULT_DURATION),
    closeButton: dismissible ?? true,
  });
}

export const useNotificationStore = create(() => ({
  // Retained so any remaining `.notifications` selector reads an empty list
  // rather than undefined; nothing renders from it any more.
  notifications: [],

  addNotification: (notification = {}) => show(notification.type || "info", notification),

  removeNotification: (id) => toast.dismiss(id),

  clearAll: () => toast.dismiss(),

  success: (message, title) => show("success", { message, title }),
  error: (message, title) => show("error", { message, title }),
  warning: (message, title) => show("warning", { message, title }),
  info: (message, title) => show("info", { message, title }),
}));

/** Imperative access outside React (event handlers, non-component modules). */
export const notify = {
  success: (message, title) => show("success", { message, title }),
  error: (message, title) => show("error", { message, title }),
  warning: (message, title) => show("warning", { message, title }),
  info: (message, title) => show("info", { message, title }),
  dismiss: (id) => toast.dismiss(id),
};
