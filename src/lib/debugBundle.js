import os from "node:os";
import pkg from "../../package.json" with { type: "json" };
import { getAdapter } from "@/lib/db/driver.js";
import { parseJson } from "@/lib/db/helpers/jsonCol.js";
import { DATA_DIR } from "@/lib/dataDir.js";
import {
  getCombos,
  getProviderConnections,
  getPublishedModels,
  getSettings,
} from "@/lib/db/index.js";
import { getRecentLogs, getRequestDetails, getUsageStats } from "@/lib/usageDb";

// Credential-shaped keys are replaced with a marker — never their value.
// Deliberately narrow: a blanket /token/ also swallows `tokens`, `promptTokens`,
// `max_tokens`… i.e. exactly the usage numbers a debug bundle exists to show.
const SECRET_EXACT_KEYS = new Set([
  "token", "key", "apikey", "api_key", "secret", "password", "passwd", "cookie",
  "authorization", "credential", "credentials", "bearer", "signature", "jwt",
  "salt", "machineid",
]);
const SECRET_KEY_PATTERN = /(secret|password|passwd|credential|authorization|cookie|bearer|signature|private[-_]?key|api[-_]?key|(?:access|refresh|id|auth|session|csrf|cli|copilot)[-_]?token|hash$)/i;
const REDACTED = "[redacted]";
const MAX_STRING = 2000;

// Display-only fields that look credential-shaped but carry no secret: the label
// an admin gave a key, counts, and the already-masked prefix shown in the UI.
const SAFE_KEYS = new Set(["apikeyname", "keyname", "apikeycount", "activeapikeycount", "hasapikey", "apikeymasked"]);

function isSecretKey(key) {
  const lower = String(key).toLowerCase();
  if (SAFE_KEYS.has(lower)) return false;
  return SECRET_EXACT_KEYS.has(lower) || SECRET_KEY_PATTERN.test(key);
}

/**
 * Deep-copy a value for the bundle, replacing secret-looking fields and clamping
 * long strings. A debug bundle is meant to be handed to someone else, so the
 * default is to drop anything credential-shaped rather than to keep it.
 */
export function redact(value, depth = 0) {
  if (value == null) return value;
  if (depth > 8) return "[depth-limit]";

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING} chars]` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => redact(item, depth + 1));

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretKey(key)) {
      out[key] = entry == null ? entry : REDACTED;
      continue;
    }
    out[key] = redact(entry, depth + 1);
  }
  return out;
}

/** Replace the user's home directory with ~ so paths stay readable but not personal. */
function shortenPath(value) {
  const home = os.homedir();
  return typeof value === "string" && home ? value.split(home).join("~") : value;
}

function summarizeUsage(stats) {
  if (!stats) return null;
  const byModel = Object.values(stats.byModel || {})
    .sort((a, b) => (b.requests || 0) - (a.requests || 0))
    .slice(0, 20)
    .map((row) => ({
      model: row.rawModel,
      provider: row.provider,
      requests: row.requests,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      cost: row.cost,
      lastUsed: row.lastUsed,
    }));

  return {
    totalRequests: stats.totalRequests,
    totalPromptTokens: stats.totalPromptTokens,
    totalCompletionTokens: stats.totalCompletionTokens,
    totalCost: stats.totalCost,
    byStatus: stats.byStatus || null,
    byModel,
  };
}

/**
 * Diagnostic snapshot for bug reports: environment, redacted settings, recent
 * request logs, recent request details, and a usage rollup. No credentials.
 * @param {object} [options]
 * @param {number} [options.detailLimit=50] how many recent request details to include
 * @param {string} [options.period="24h"] usage window to summarize
 */
export async function buildDebugBundle({ detailLimit = 50, period = "24h" } = {}) {
  const [
    adapter,
    settings,
    logs,
    details,
    stats,
    connections,
    combos,
    published,
  ] = await Promise.all([
    getAdapter().catch(() => null),
    getSettings().catch(() => ({})),
    getRecentLogs(200).catch(() => []),
    getRequestDetails({ page: 1, pageSize: Math.min(Math.max(detailLimit, 1), 100) }).catch(() => ({ details: [] })),
    getUsageStats(period).catch(() => null),
    getProviderConnections().catch(() => []),
    getCombos().catch(() => []),
    getPublishedModels().catch(() => []),
  ]);

  const publishedIds = new Set((published || []).map((entry) => entry.comboId));
  // Only administrator overrides — the built-in rate table is in the repo already.
  const customPricing = {};
  try {
    for (const row of adapter?.all?.("SELECT key, value FROM kv WHERE scope = 'pricing'") || []) {
      customPricing[row.key] = parseJson(row.value, {});
    }
  } catch { /* pricing overrides are optional context */ }

  return {
    generatedAt: new Date().toISOString(),
    app: {
      name: pkg.name || "9router-app",
      version: pkg.version || "unknown",
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`,
      uptimeSeconds: Math.round(process.uptime()),
      dataDir: shortenPath(DATA_DIR),
      dbDriver: adapter?.driver || "unknown",
      port: process.env.PORT || null,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    },
    settings: redact(settings),
    routes: (combos || []).map((combo) => ({
      name: combo.name,
      kind: combo.kind || "llm",
      modelProvider: combo.modelProvider || null,
      enabled: publishedIds.has(combo.id),
      memberCount: Array.isArray(combo.models) ? combo.models.length : 0,
      members: combo.models || [],
      disabledMembers: combo.disabledMembers || [],
    })),
    connections: (connections || []).map((connection) => ({
      id: connection.id,
      provider: connection.provider,
      authType: connection.authType,
      isActive: connection.isActive !== false,
      priority: connection.priority ?? null,
      testStatus: connection.testStatus || null,
      // Only the shape of the credential matters for debugging, never its value.
      hasApiKey: Boolean(connection.apiKey),
      hasAccessToken: Boolean(connection.accessToken),
      hasRefreshToken: Boolean(connection.refreshToken),
    })),
    customPricing: redact(customPricing),
    usage: { period, ...(summarizeUsage(stats) || {}) },
    recentLogs: redact(logs),
    recentRequestDetails: redact(details?.details || []),
  };
}
