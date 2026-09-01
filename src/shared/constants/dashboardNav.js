import {
  Activity,
  AudioLines,
  Boxes,
  Braces,
  Brush,
  ChartColumn,
  Coins,
  Film,
  Gauge,
  GitFork,
  Globe,
  House,
  Images,
  KeyRound,
  Languages,
  Lock,
  Mic,
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

import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";

/**
 * Single source of truth for both dashboard rails.
 *
 * The sidebar renders these groups and the ⌘K palette flattens the same list, so
 * a route can never be reachable from one and missing from the other. The admin
 * rail used to declare its own copy inline in AdminSidebar.js, which is how the
 * two drifted; there is one file now and one `<Sidebar variant>` reading it.
 *
 * Item fields:
 *   `exact`              match only this route, not its children
 *   `match`              the `?tab=` value this row corresponds to
 *   `requiresTranslator` hide unless the translator setting is on
 *   `children`           renders as a collapsible submenu
 */

const MEDIA_ICONS = {
  embedding: Braces,
  image: Brush,
  video: Film,
  tts: AudioLines,
  stt: Mic,
};

/** Kinds with a finished management screen — the rest are API-only for now. */
const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];

/**
 * Web fetch and web search share one screen, so the rail shows one row instead
 * of two that lead to the same place.
 */
function mediaChildren(base) {
  const kinds = MEDIA_PROVIDER_KINDS.filter((kind) => VISIBLE_MEDIA_KINDS.includes(kind.id)).map(
    (kind) => ({
      href: `${base}/media-providers/${kind.id}`,
      label: kind.label,
      icon: MEDIA_ICONS[kind.id] || Images,
    }),
  );
  return [
    ...kinds,
    { href: `${base}/media-providers/web`, label: "Web Fetch & Search", icon: Globe },
  ];
}

export const DASHBOARD_NAV_GROUPS = [
  {
    id: "pinned",
    label: "Overview",
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
      { href: "/dashboard/models", label: "Models", icon: Boxes },
      // Public page, outside the dashboard shell — opens in the same tab.
      { href: "/ranking", label: "Model Ranking", icon: Trophy },
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    items: [{ href: "/dashboard/token-saver", label: "Token Saver", icon: Coins }],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        href: "/dashboard/account",
        label: "Profile",
        icon: User,
        exact: true,
        match: "profile",
      },
      { href: "/dashboard/account?tab=wallet", label: "Wallet", icon: Wallet, match: "wallet" },
      { href: "/dashboard/account?tab=security", label: "Security", icon: Lock, match: "security" },
    ],
  },
];

export const ADMIN_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: House, exact: true },
      { href: "/admin/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    id: "management",
    label: "Management",
    items: [
      { href: "/admin/providers", label: "Providers", icon: Server },
      { href: "/admin/users", label: "Accounts", icon: Users },
      { href: "/admin/router", label: "Model Routes", icon: GitFork },
      { href: "/admin/models", label: "Models", icon: Boxes },
      {
        href: "/admin/media-providers",
        label: "Media Providers",
        icon: Images,
        children: mediaChildren("/admin"),
      },
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    items: [
      { href: "/admin/skills", label: "Skills", icon: Puzzle },
      { href: "/admin/cli-tools", label: "CLI Tools", icon: Terminal },
      {
        href: "/admin/translator",
        label: "Translator",
        icon: Languages,
        requiresTranslator: true,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/quota", label: "Quota", icon: Gauge },
      { href: "/admin/proxy-pools", label: "Proxy Pools", icon: Network },
      { href: "/admin/console-log", label: "Console Log", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Rows visible to the current viewer — the one place gating is decided. */
export function visibleNavItems(items, { isAdmin, enableTranslator } = {}) {
  return items.filter((item) => {
    if (item.admin && !isAdmin) return false;
    if (item.requiresTranslator && !enableTranslator) return false;
    return true;
  });
}

/** Flatten groups into the ⌘K palette's row shape, submenus included. */
export function flattenNavForPalette(groups) {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      const self = { href: item.href, label: item.label, group: group.label, icon: item.icon };
      if (!item.children?.length) return [self];
      // A parent with children is a disclosure, not a destination, so only the
      // children are listed — jumping to the parent href would 404.
      return item.children.map((child) => ({
        href: child.href,
        label: child.label,
        group: item.label,
        icon: child.icon,
      }));
    }),
  );
}
