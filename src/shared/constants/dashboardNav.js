import {
  ChartColumn,
  Coins,
  House,
  KeyRound,
  Lock,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Single source of truth for the user dashboard rail: the sidebar renders these
 * groups, and the ⌘K palette flattens the same list, so a route can never be
 * reachable from one and missing from the other.
 *
 * `admin` gates a row behind the admin dashboard view; `requiresTranslator`
 * behind the translator setting. `exact` matches only the route itself, and
 * `match` is the `?tab=` value an account row corresponds to.
 *
 * Admin-only items have been moved to the admin dashboard.
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
      // Public page (outside the dashboard shell) — opens in the same tab.
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
 * Rows visible for the current viewer — the one place gating is decided.
 * Admin items are no longer shown in user sidebar.
 */
export function visibleNavItems(items, { isAdmin, enableTranslator }) {
  return items.filter((item) => {
    if (item.admin && !isAdmin) return false;
    if (item.requiresTranslator && !enableTranslator) return false;
    return true;
  });
}
