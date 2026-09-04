"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import PropTypes from "prop-types";

import { cn } from "@/shared/utils/cn";
import { useSidebarCollapsed } from "@/shared/hooks/useSidebarCollapsed";
import Sidebar from "../Sidebar";
import Header from "../Header";

/**
 * The dashboard shell for both the user and admin route groups.
 *
 * Toasts are not rendered here — `<Toaster />` is mounted once in the root
 * layout. The previous version inlined a toast renderer, and the admin layout
 * carried a verbatim copy of it.
 *
 * Routes that manage their own scrolling (a chat transcript, a log tail) opt out
 * of the shell's padding and overflow rather than fighting it.
 */
const FULL_BLEED_ROUTES = new Set([
  "/dashboard/basic-chat",
  "/admin/basic-chat",
  "/dashboard/console-log",
  "/admin/console-log",
]);

export default function DashboardLayout({ children, variant = "user" }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  // Read-only here so the Suspense placeholder matches the rail's real width and
  // the content doesn't jump once the sidebar hydrates.
  const [sidebarCollapsed] = useSidebarCollapsed();

  const fullBleed = FULL_BLEED_ROUTES.has(pathname);

  return (
    // `h-dvh`, not `h-screen`: `100vh` is the viewport *including* the mobile
    // browser's collapsible URL bar, so the shell would stand taller than what
    // is actually visible and the document itself would gain a second scroll —
    // the page kept scrolling after the content ended and the sticky header slid
    // away with it. `dvh` tracks the visible viewport, so nothing overflows.
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {sidebarOpen ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
        />
      ) : null}

      {/* Desktop rail */}
      <div className="hidden h-full lg:flex">
        <Suspense
          fallback={
            <div
              className={cn(
                "h-full shrink-0 border-r bg-sidebar",
                sidebarCollapsed ? "w-16" : "w-64",
              )}
            />
          }
        >
          <Sidebar variant={variant} />
        </Suspense>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Suspense fallback={null}>
          <Sidebar variant={variant} onClose={() => setSidebarOpen(false)} />
        </Suspense>
      </div>

      <main className="flex h-full min-w-0 flex-1 flex-col">
        {/* Not keyed by pathname: the header reads its page title from the
            pathname reactively, and remounting it re-ran the identity fetch on
            every navigation just to arrive at the same answer. */}
        <Header variant={variant} onMenuClick={() => setSidebarOpen(true)} />
        <div
          className={cn(
            // `overscroll-contain` keeps a wheel/touch gesture that has already
            // reached this box's end from chaining out to the document.
            "custom-scrollbar flex-1 overscroll-contain",
            fullBleed
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto p-4 sm:p-6 xl:p-8",
          )}
        >
          <div className={cn(fullBleed ? "flex h-full w-full flex-1 flex-col" : "mx-auto max-w-7xl")}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

DashboardLayout.propTypes = {
  variant: PropTypes.oneOf(["user", "admin"]),
};
