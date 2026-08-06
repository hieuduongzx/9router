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
  User,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Single source of truth for the dashboard rail: the sidebar renders these
 * groups, and the ⌘K palette flattens the same list, so a route can never be
 * reachable from one and missing from the other.
 *
 * `admin` gates a row behind the admin dashboard view; `requiresTranslator`
 * behind the translator setting. `exact` matches only the route itself, and
 * `match` is the `?tab=` value an account row corresponds to.
 */
export const DASHBOARD_NAV_GROUPS = [
  {
    id: "pinned",
    label: "Pinned",
    items: [
      { href: "/dashboard", label: "Home", icon: House, exact: true },
      { href: "/dashboard/providers", label: "Providers", icon: Server, admin: true },
      { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    id: "traffic",
    label: "Traffic",
    items: [
      { href: "/dashboard/usage", label: "Usage", icon: ChartColumn },
      { href: "/dashboard/activity", label: "Activity", icon: Activity, admin: true },
      { href: "/dashboard/combos", label: "Model Routes", icon: GitFork, admin: true },
      { href: "/dashboard/models", label: "Models", icon: Boxes },
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    // The media submenu is injected by the sidebar at the head of this group;
    // its leaf routes are contributed to the palette separately.
    items: [
      { href: "/dashboard/skills", label: "Skills", icon: Puzzle, admin: true },
      { href: "/dashboard/cli-tools", label: "CLI Tools", icon: Terminal, admin: true },
      { href: "/dashboard/token-saver", label: "Token Saver", icon: Coins, admin: true },
      {
        href: "/dashboard/translator",
        label: "Translator",
        icon: Languages,
        admin: true,
        requiresTranslator: true,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/dashboard/users", label: "Accounts", icon: Users, admin: true },
      { href: "/dashboard/quota", label: "Quota", icon: Gauge, admin: true },
      { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: Network, admin: true },
      { href: "/dashboard/console-log", label: "Console Log", icon: ScrollText, admin: true },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, admin: true },
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

/** Rows visible for the current viewer — the one place gating is decided. */
export function visibleNavItems(items, { isAdmin, enableTranslator }) {
  return items.filter((item) => {
    if (item.admin && !isAdmin) return false;
    if (item.requiresTranslator && !enableTranslator) return false;
    return true;
  });
}
