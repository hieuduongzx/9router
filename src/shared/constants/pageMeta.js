import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS } from "@/shared/constants/providers";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";

/**
 * Page title, description and breadcrumb trail for a dashboard route.
 *
 * This lived as a 200-line if/`includes` ladder inside `Header`, which made the
 * order of the branches load-bearing (`/media-providers` had to be tested before
 * `/providers`, `/users/[id]` before `/users`) and left several routes with no
 * title at all. It is a table now, matched longest-pattern-first, so adding a
 * route can't silently shadow another.
 *
 * Patterns are matched against the path with the `/dashboard` or `/admin` prefix
 * stripped, because the admin route group re-exports the same pages.
 */

/** Static routes, keyed by the prefix-stripped path. */
const STATIC_ROUTES = {
  "": { title: "Dashboard", description: "Model traffic, access, and account status at a glance" },
  "/activity": { title: "Activity", description: "System, provider, and request operations" },
  "/api-keys": { title: "API Keys", description: "Manage authentication keys for /v1" },
  "/account": { title: "Account", description: "Profile, wallet, and sign-in security" },
  "/basic-chat": { title: "Chat", description: "Send a request through the gateway and inspect it" },
  "/cli-tools": { title: "CLI Tools", description: "Point a coding CLI at this gateway" },
  "/combos": { title: "Model Routes", description: "Public model routing and ownership" },
  // Admin rail serves the same page from /admin/router.
  "/router": { title: "Model Routes", description: "Public model routing, ownership, and pricing" },
  "/console-log": { title: "Console Log", description: "Live server console output" },
  "/endpoint": { title: "Endpoint", description: "Base URL and credentials for clients" },
  "/media-providers": { title: "Media Providers", description: "Embedding, image, audio, and video providers" },
  "/media-providers/web": { title: "Web Fetch & Search", description: "Providers that read the live web" },
  "/mitm": { title: "MITM Proxy", description: "Intercept CLI tool traffic and route it here" },
  "/models": { title: "Models", description: "Available routed models" },
  "/providers": { title: "Providers", description: "Manage upstream provider connections" },
  "/providers/new": {
    title: "Add Provider",
    description: "Connect an upstream by OAuth or API key",
    breadcrumbs: [{ label: "Providers", href: "/providers" }, { label: "Add" }],
  },
  "/proxy-pools": { title: "Proxy Pools", description: "Outbound proxy pools and deployment" },
  "/pxpipe": { title: "pxpipe", description: "Prompt compression service and savings" },
  "/quota": { title: "Quota Tracker", description: "Upstream rate and quota limits per account" },
  "/settings": { title: "Settings", description: "System preferences and access control" },
  "/settings/pricing": {
    title: "Pricing",
    description: "Per-model price overrides",
    breadcrumbs: [{ label: "Settings", href: "/settings" }, { label: "Pricing" }],
  },
  "/skills": { title: "Agent Skills", description: "Copy a link and paste it to your AI — no install" },
  "/token-saver": { title: "Token Saver", description: "Compress prompts and results to cut tokens" },
  "/translator": { title: "Translator", description: "Debug translation between request formats" },
  "/usage": { title: "Usage", description: "Model tokens, cost, and request history" },
  "/users": { title: "Accounts", description: "Manage account access and roles" },
};

/**
 * Dynamic routes. Each entry gets the regex match and the route prefix, and
 * returns the same shape as a static entry. Ordered most specific first.
 */
const DYNAMIC_ROUTES = [
  {
    // /media-providers/[kind]/[id]
    pattern: /^\/media-providers\/([^/]+)\/([^/]+)$/,
    resolve: ([, kindId, providerId], prefix) => {
      if (kindId === "combo") return null;
      const kind = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
      const provider = AI_PROVIDERS[providerId];
      return {
        title: provider?.name || providerId,
        breadcrumbs: [
          { label: "Media Providers", href: `${prefix}/media-providers/${kindId}` },
          { label: kind?.label || kindId, href: `${prefix}/media-providers/${kindId}` },
          { label: provider?.name || providerId, image: getProviderIconSrc(providerId) },
        ],
      };
    },
  },
  {
    // /media-providers/combo/[id]
    pattern: /^\/media-providers\/combo\/([^/]+)$/,
    resolve: (_match, prefix) => ({
      title: "Media Combo",
      description: "Fallback order across media providers",
      breadcrumbs: [
        { label: "Media Providers", href: `${prefix}/media-providers/embedding` },
        { label: "Combo" },
      ],
    }),
  },
  {
    // /media-providers/[kind]
    pattern: /^\/media-providers\/([^/]+)$/,
    resolve: ([, kindId]) => {
      if (kindId === "web" || kindId === "combo") return null;
      const kind = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
      return {
        title: kind?.label || kindId,
        description: `Manage your ${kind?.label || kindId} providers`,
      };
    },
  },
  {
    // /providers/[id]
    pattern: /^\/providers\/([^/]+)$/,
    resolve: ([, providerId], prefix) => {
      const info = OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
      return {
        title: info?.name || providerId,
        breadcrumbs: [
          { label: "Providers", href: `${prefix}/providers` },
          { label: info?.name || providerId, image: getProviderIconSrc(info?.id || providerId) },
        ],
      };
    },
  },
  {
    // /users/[id]
    pattern: /^\/users\/([^/]+)$/,
    resolve: (_match, prefix) => ({
      title: "Account detail",
      description: "Access, credit, keys, and usage for one account",
      breadcrumbs: [{ label: "Accounts", href: `${prefix}/users` }, { label: "Detail" }],
    }),
  },
  {
    // /cli-tools/[toolId]
    pattern: /^\/cli-tools\/([^/]+)$/,
    resolve: ([, toolId], prefix) => ({
      title: toolId,
      description: "Configure this tool to route through the gateway",
      breadcrumbs: [{ label: "CLI Tools", href: `${prefix}/cli-tools` }, { label: toolId }],
    }),
  },
];

const EMPTY = { title: "", description: "", breadcrumbs: [] };

/** Split `/admin/providers/x` into its shell prefix and the route below it. */
function splitPath(pathname) {
  for (const prefix of ["/dashboard", "/admin"]) {
    if (pathname === prefix) return { prefix, route: "" };
    if (pathname.startsWith(`${prefix}/`)) {
      return { prefix, route: pathname.slice(prefix.length).replace(/\/$/, "") };
    }
  }
  return { prefix: "", route: pathname.replace(/\/$/, "") };
}

/** Breadcrumb hrefs in the table are prefix-relative; make them absolute. */
function withPrefix(breadcrumbs, prefix) {
  if (!breadcrumbs?.length) return [];
  return breadcrumbs.map((crumb) =>
    crumb.href?.startsWith("/") && !crumb.href.startsWith(prefix)
      ? { ...crumb, href: `${prefix}${crumb.href}` }
      : crumb,
  );
}

export function getPageMeta(pathname) {
  if (!pathname) return EMPTY;
  const { prefix, route } = splitPath(pathname);

  for (const { pattern, resolve } of DYNAMIC_ROUTES) {
    const match = route.match(pattern);
    if (!match) continue;
    const meta = resolve(match, prefix);
    if (meta) {
      return {
        title: meta.title || "",
        description: meta.description || "",
        breadcrumbs: withPrefix(meta.breadcrumbs, prefix),
      };
    }
  }

  const meta = STATIC_ROUTES[route];
  if (!meta) return EMPTY;
  return {
    title: meta.title || "",
    description: meta.description || "",
    breadcrumbs: withPrefix(meta.breadcrumbs, prefix),
  };
}
