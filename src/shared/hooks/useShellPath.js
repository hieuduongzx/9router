"use client";

import { usePathname } from "next/navigation";

/**
 * Rewrite a `/dashboard/...` link for whichever dashboard shell is mounted.
 *
 * Almost every page under `src/app/(admin)/admin/*` is a re-export of its
 * `(dashboard)` twin, so one component renders under two prefixes while its
 * links are written as `/dashboard/...` literals. Following one of those from
 * inside the admin panel used to leave the admin route group outright: the rail
 * swapped to the user one and the shell looked like it had switched itself.
 *
 * `dashboardGuard` redirects admin-only dashboard paths back into `/admin`, so
 * this is belt-and-braces there — it just saves the redirect hop. It is load
 * bearing for the account-safe pages (API keys, usage, models, token saver,
 * account), which are legitimately reachable under both prefixes and therefore
 * are never redirected.
 *
 * The two shells are not a plain mirror: Model Routes is `/dashboard/combos` for
 * a user and `/admin/router` for an administrator, so the rename is table-driven.
 */
const ADMIN_RENAMES = [["/dashboard/combos", "/admin/router"]];

/** True when `path` is `prefix` itself or something nested/qualified under it. */
function matchesPrefix(path, prefix) {
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return rest === "" || rest.startsWith("/") || rest.startsWith("?") || rest.startsWith("#");
}

export function useShellPath() {
  const pathname = usePathname() || "";
  const inAdminShell = pathname === "/admin" || pathname.startsWith("/admin/");

  return function shellPath(path) {
    if (!inAdminShell || typeof path !== "string" || !path.startsWith("/dashboard")) return path;
    for (const [from, to] of ADMIN_RENAMES) {
      if (matchesPrefix(path, from)) return `${to}${path.slice(from.length)}`;
    }
    return `/admin${path.slice("/dashboard".length)}`;
  };
}
