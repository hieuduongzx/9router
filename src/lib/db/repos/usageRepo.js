import { EventEmitter } from "events";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { getMeta, setMeta } from "../helpers/metaStore.js";
import { getCachedTokens, getCacheCreationTokens, getInputTokens } from "../../../shared/utils/requestTokens.js";
import { providerLabel } from "../../../shared/utils/providerLabel.js";

function maskApiKey(key) {
  if (!key || typeof key !== "string") return null;
  if (key.length <= 8) return key.charAt(0) + "***";
  return key.slice(0, 8) + "***";
}

async function debitOwnerForApiKeyUsage(apiKey, costUsd, meta = null) {
  if (!apiKey || !(Number(costUsd) > 0)) return;
  const { resolveApiKey } = await import("./apiKeysRepo.js");
  const { debitUserCreditForUsage } = await import("./usersRepo.js");
  const resolved = await resolveApiKey(apiKey);
  const ownerId = resolved?.owner?.id || resolved?.ownerUserId;
  if (!ownerId) return;
  // Admin keys still debit when balance > 0 so self-usage is visible; zero stays allowed.
  await debitUserCreditForUsage(ownerId, costUsd, meta);
}


/**
 * Cache token counts are stored inside the JSON `tokens` blob, not as columns,
 * and the key depends on the upstream family: OpenAI-style `cached_tokens` vs
 * Claude-style `cache_read_input_tokens`. These mirror getCachedTokens() /
 * getCacheCreationTokens() from shared/utils/requestTokens.js so a SQL SUM and
 * a JS read of the same row can never disagree.
 *
 * `json_valid` guards rows written before the column was JSON (and any truncated
 * blob): json_extract on invalid JSON raises, which would fail the whole query.
 */
export const CACHED_TOKENS_SQL = (column) => `CASE WHEN json_valid(${column}) THEN COALESCE(
  CAST(json_extract(${column}, '$.cached_tokens') AS INTEGER),
  CAST(json_extract(${column}, '$.cache_read_input_tokens') AS INTEGER),
  0) ELSE 0 END`;

export const CACHE_WRITE_TOKENS_SQL = (column) => `CASE WHEN json_valid(${column}) THEN COALESCE(
  CAST(json_extract(${column}, '$.cache_creation_input_tokens') AS INTEGER),
  CAST(json_extract(${column}, '$.prompt_tokens_details.cache_creation_tokens') AS INTEGER),
  0) ELSE 0 END`;

const PENDING_TIMEOUT_MS = 60 * 1000;
const RING_CAP = 50;
const CONN_CACHE_TTL_MS = 30 * 1000;
const PERIOD_MS = {
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "6h": 21600000,
  "12h": 43200000,
  "24h": 86400000,
  "3d": 259200000,
  "7d": 604800000,
  "14d": 1209600000,
  "30d": 2592000000,
  "60d": 5184000000,
};

/** Chart bucket sizing per period: how many buckets, and the width of each. */
const CHART_BUCKET_CONFIG = {
  "5m": { bucketMs: 15000, bucketCount: 20 },
  "15m": { bucketMs: 30000, bucketCount: 30 },
  "1h": { bucketMs: 120000, bucketCount: 30 },
  "6h": { bucketMs: 900000, bucketCount: 24 },
  "12h": { bucketMs: 1800000, bucketCount: 24 },
  "24h": { bucketMs: 3600000, bucketCount: 24 },
  "3d": { bucketMs: 3600000, bucketCount: 72 },
  "7d": { bucketMs: 86400000, bucketCount: 7 },
  "14d": { bucketMs: 86400000, bucketCount: 14 },
  "30d": { bucketMs: 86400000, bucketCount: 30 },
  "60d": { bucketMs: 86400000, bucketCount: 60 },
};

// In-memory state shared across Next.js modules
if (!global._pendingRequests) global._pendingRequests = { byModel: {}, byAccount: {} };
if (!global._pendingRequestsByApiKey) global._pendingRequestsByApiKey = {};
if (!global._lastErrorProvider) global._lastErrorProvider = { provider: "", ts: 0 };
if (!global._statsEmitter) {
  global._statsEmitter = new EventEmitter();
  global._statsEmitter.setMaxListeners(50);
}
if (!global._pendingTimers) global._pendingTimers = {};
if (!global._recentRing) global._recentRing = { items: [], initialized: false };
if (!global._connectionMapCache) global._connectionMapCache = { map: {}, ts: 0 };
if (!global._statsEmitTimers) global._statsEmitTimers = { pending: null, update: null };

const pendingRequests = global._pendingRequests;
const pendingRequestsByApiKey = global._pendingRequestsByApiKey;
const lastErrorProvider = global._lastErrorProvider;
const pendingTimers = global._pendingTimers;
const recentRing = global._recentRing;
const connCache = global._connectionMapCache;
const statsEmitTimers = global._statsEmitTimers;

export const statsEmitter = global._statsEmitter;

function scheduleStatsEvent(event, delayMs = 150) {
  const key = event === "update" ? "update" : "pending";
  if (statsEmitTimers[key]) return;
  statsEmitTimers[key] = setTimeout(() => {
    statsEmitTimers[key] = null;
    statsEmitter.emit(event);
  }, delayMs);
  statsEmitTimers[key]?.unref?.();
}

function getLocalDateKey(timestamp) {
  const d = timestamp ? new Date(timestamp) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addToCounter(target, key, values) {
  if (!target[key]) target[key] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0 };
  target[key].requests += values.requests || 1;
  target[key].promptTokens += values.promptTokens || 0;
  target[key].completionTokens += values.completionTokens || 0;
  target[key].cachedTokens += values.cachedTokens || 0;
  target[key].cost += values.cost || 0;
  if (values.meta) Object.assign(target[key], values.meta);
}

function aggregateEntryToDay(day, entry) {
  const promptTokens = entry.tokens?.prompt_tokens || entry.tokens?.input_tokens || 0;
  const completionTokens = entry.tokens?.completion_tokens || entry.tokens?.output_tokens || 0;
  const cachedTokens = entry.tokens?.cached_tokens || entry.tokens?.cache_read_input_tokens || 0;
  const cost = entry.cost || 0;
  const vals = { promptTokens, completionTokens, cachedTokens, cost };

  day.requests = (day.requests || 0) + 1;
  day.promptTokens = (day.promptTokens || 0) + promptTokens;
  day.completionTokens = (day.completionTokens || 0) + completionTokens;
  day.cachedTokens = (day.cachedTokens || 0) + cachedTokens;
  day.cost = (day.cost || 0) + cost;

  day.byProvider ||= {};
  day.byModel ||= {};
  day.byAccount ||= {};
  day.byApiKey ||= {};
  day.byEndpoint ||= {};

  if (entry.provider) addToCounter(day.byProvider, entry.provider, vals);

  const modelKey = entry.provider ? `${entry.model}|${entry.provider}` : entry.model;
  addToCounter(day.byModel, modelKey, { ...vals, meta: { rawModel: entry.model, provider: entry.provider } });

  if (entry.connectionId) {
    addToCounter(day.byAccount, entry.connectionId, { ...vals, meta: { rawModel: entry.model, provider: entry.provider } });
  }

  const apiKeyVal = entry.apiKey && typeof entry.apiKey === "string" ? entry.apiKey : "local-no-key";
  const akModelKey = `${apiKeyVal}|${entry.model}|${entry.provider || "unknown"}`;
  addToCounter(day.byApiKey, akModelKey, { ...vals, meta: { rawModel: entry.model, provider: entry.provider, apiKey: entry.apiKey || null } });

  const endpoint = entry.endpoint || "Unknown";
  const epKey = `${endpoint}|${entry.model}|${entry.provider || "unknown"}`;
  addToCounter(day.byEndpoint, epKey, { ...vals, meta: { endpoint, rawModel: entry.model, provider: entry.provider } });
}

function pushToRing(entry) {
  recentRing.items.push(entry);
  if (recentRing.items.length > RING_CAP) {
    recentRing.items = recentRing.items.slice(-RING_CAP);
  }
}

async function getConnectionMapCached() {
  if (Date.now() - connCache.ts < CONN_CACHE_TTL_MS) return connCache.map;
  try {
    const { getProviderConnections } = await import("./connectionsRepo.js");
    const all = await getProviderConnections();
    const map = {};
    for (const c of all) map[c.id] = c.name || c.email || c.id;
    connCache.map = map;
    connCache.ts = Date.now();
  } catch {}
  return connCache.map;
}

async function ensureRingInitialized() {
  if (recentRing.initialized) return;
  recentRing.initialized = true;
  try {
    const db = await getAdapter();
    const rows = db.all(`SELECT timestamp, provider, model, connectionId, apiKey, endpoint, cost, status, tokens FROM usageHistory ORDER BY id DESC LIMIT ?`, [RING_CAP]);
    recentRing.items = rows.reverse().map((r) => ({
      timestamp: r.timestamp, provider: r.provider, model: r.model, connectionId: r.connectionId,
      apiKey: r.apiKey, endpoint: r.endpoint, cost: r.cost, status: r.status,
      tokens: parseJson(r.tokens, {}),
    }));
  } catch {}
}

export async function calculateRequestCost(provider, model, tokens, publicModel = null) {
  if (!tokens || !provider || !model) return 0;
  try {
    const { getPricingForModel } = await import("./pricingRepo.js");
    const pricing = await getPricingForModel(provider, model, publicModel);
    if (!pricing) return 0;

    // Delegate the actual math to the single source of truth (avoids the two
    // copies drifting apart — see open-sse/providers/pricing.js for the
    // cache-inclusive prompt_tokens convention this assumes).
    const { calculateCostFromTokens } = await import("open-sse/providers/pricing.js");
    return calculateCostFromTokens(tokens, pricing);
  } catch (e) {
    console.error("Error calculating cost:", e);
    return 0;
  }
}

/**
 * Input-side vs output-side cost split for display (e.g. request detail drawer).
 * Mirrors open-sse/providers/pricing.js's calculateCostFromTokens formula, split
 * into two buckets instead of one scalar. Returns null when pricing is unavailable.
 */
export async function calculateRequestCostBreakdown(provider, model, tokens, publicModel = null) {
  if (!tokens || !provider || !model) return null;
  try {
    const { getPricingForModel } = await import("./pricingRepo.js");
    const pricing = await getPricingForModel(provider, model, publicModel);
    if (!pricing) return null;

    const inputTokens = tokens.prompt_tokens || tokens.input_tokens || 0;
    const cachedTokens = tokens.cached_tokens || tokens.cache_read_input_tokens || 0;
    const cacheCreationTokens = tokens.cache_creation_input_tokens || 0;
    const nonCachedInput = Math.max(0, inputTokens - cachedTokens - cacheCreationTokens);
    const outputTokens = tokens.completion_tokens || tokens.output_tokens || 0;
    const reasoningTokens = tokens.reasoning_tokens || 0;

    let input = nonCachedInput * (pricing.input / 1000000);
    if (cachedTokens > 0) input += cachedTokens * ((pricing.cached || pricing.input) / 1000000);
    if (cacheCreationTokens > 0) input += cacheCreationTokens * ((pricing.cache_creation || pricing.input) / 1000000);

    let output = outputTokens * (pricing.output / 1000000);
    if (reasoningTokens > 0) output += reasoningTokens * ((pricing.reasoning || pricing.output) / 1000000);

    return { input, output, total: input + output };
  } catch (e) {
    console.error("Error calculating cost breakdown:", e);
    return null;
  }
}

export function trackPendingRequest(model, provider, connectionId, started, error = false, apiKey = null) {
  const modelKey = provider ? `${model} (${provider})` : model;
  const apiKeyBucket = apiKey || "__local__";
  const timerKey = `${connectionId}|${apiKeyBucket}|${modelKey}`;

  if (!pendingRequests.byModel[modelKey]) pendingRequests.byModel[modelKey] = 0;
  pendingRequests.byModel[modelKey] = Math.max(0, pendingRequests.byModel[modelKey] + (started ? 1 : -1));
  if (pendingRequests.byModel[modelKey] === 0) delete pendingRequests.byModel[modelKey];

  if (connectionId) {
    if (!pendingRequests.byAccount[connectionId]) pendingRequests.byAccount[connectionId] = {};
    if (!pendingRequests.byAccount[connectionId][modelKey]) pendingRequests.byAccount[connectionId][modelKey] = 0;
    pendingRequests.byAccount[connectionId][modelKey] = Math.max(0, pendingRequests.byAccount[connectionId][modelKey] + (started ? 1 : -1));
    if (pendingRequests.byAccount[connectionId][modelKey] === 0) {
      delete pendingRequests.byAccount[connectionId][modelKey];
      if (Object.keys(pendingRequests.byAccount[connectionId]).length === 0) {
        delete pendingRequests.byAccount[connectionId];
      }
    }
  }

  if (!pendingRequestsByApiKey[apiKeyBucket]) pendingRequestsByApiKey[apiKeyBucket] = {};
  if (!pendingRequestsByApiKey[apiKeyBucket][modelKey]) pendingRequestsByApiKey[apiKeyBucket][modelKey] = 0;
  pendingRequestsByApiKey[apiKeyBucket][modelKey] = Math.max(
    0,
    pendingRequestsByApiKey[apiKeyBucket][modelKey] + (started ? 1 : -1),
  );
  if (pendingRequestsByApiKey[apiKeyBucket][modelKey] === 0) {
    delete pendingRequestsByApiKey[apiKeyBucket][modelKey];
    if (Object.keys(pendingRequestsByApiKey[apiKeyBucket]).length === 0) {
      delete pendingRequestsByApiKey[apiKeyBucket];
    }
  }

  if (started) {
    clearTimeout(pendingTimers[timerKey]);
    pendingTimers[timerKey] = setTimeout(() => {
      delete pendingTimers[timerKey];
      delete pendingRequests.byModel[modelKey];
      if (connectionId && pendingRequests.byAccount[connectionId]) {
        delete pendingRequests.byAccount[connectionId][modelKey];
        if (Object.keys(pendingRequests.byAccount[connectionId]).length === 0) {
          delete pendingRequests.byAccount[connectionId];
        }
      }
      if (pendingRequestsByApiKey[apiKeyBucket]) {
        delete pendingRequestsByApiKey[apiKeyBucket][modelKey];
        if (Object.keys(pendingRequestsByApiKey[apiKeyBucket]).length === 0) {
          delete pendingRequestsByApiKey[apiKeyBucket];
        }
      }
      scheduleStatsEvent("pending");
    }, PENDING_TIMEOUT_MS);
  } else {
    clearTimeout(pendingTimers[timerKey]);
    delete pendingTimers[timerKey];
  }

  if (!started && error && provider) {
    lastErrorProvider.provider = provider.toLowerCase();
    lastErrorProvider.ts = Date.now();
  }

  scheduleStatsEvent("pending");
}

export async function getActiveRequests() {
  const activeRequests = [];
  const connectionMap = await getConnectionMapCached();

  for (const [connectionId, models] of Object.entries(pendingRequests.byAccount)) {
    for (const [modelKey, count] of Object.entries(models)) {
      if (count > 0) {
        const accountName = connectionMap[connectionId] || `Account ${connectionId.slice(0, 8)}...`;
        const match = modelKey.match(/^(.*) \((.*)\)$/);
        activeRequests.push({
          model: match ? match[1] : modelKey,
          provider: match ? match[2] : "unknown",
          account: accountName, count,
        });
      }
    }
  }

  await ensureRingInitialized();
  const seen = new Set();
  const recentRequests = [...recentRing.items]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((e) => {
      const t = e.tokens || {};
      return {
        timestamp: e.timestamp, model: e.model, provider: e.provider || "",
        promptTokens: t.prompt_tokens || t.input_tokens || 0,
        completionTokens: t.completion_tokens || t.output_tokens || 0,
        status: e.status || "ok",
      };
    })
    .filter((e) => {
      if (e.promptTokens === 0 && e.completionTokens === 0) return false;
      const minute = e.timestamp ? e.timestamp.slice(0, 16) : "";
      const key = `${e.model}|${e.provider}|${e.promptTokens}|${e.completionTokens}|${minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);

  const errorProvider = (Date.now() - lastErrorProvider.ts < 10000) ? lastErrorProvider.provider : "";
  return { activeRequests, recentRequests, errorProvider };
}

export async function saveRequestUsage(entry) {
  try {
    const db = await getAdapter();

    if (!entry.timestamp) entry.timestamp = new Date().toISOString();
    entry.cost = await calculateRequestCost(entry.provider, entry.model, entry.tokens, entry.publicModel);

    const tokens = entry.tokens || {};
    const promptTokens = tokens.prompt_tokens || tokens.input_tokens || 0;
    const completionTokens = tokens.completion_tokens || tokens.output_tokens || 0;

    let inserted = false;

    // All 3 writes (history insert, daily upsert, lifetime counter) in ONE transaction.
    // better-sqlite3 is sync → no JS yield mid-transaction → no race in same process.
    db.transaction(() => {
      const existing = db.get(
        `SELECT id, endpoint FROM usageHistory
         WHERE timestamp = ?
           AND COALESCE(provider, '') = COALESCE(?, '')
           AND COALESCE(model, '') = COALESCE(?, '')
           AND COALESCE(connectionId, '') = COALESCE(?, '')
           AND COALESCE(apiKey, '') = COALESCE(?, '')
           AND promptTokens = ?
           AND completionTokens = ?
         ORDER BY id DESC LIMIT 1`,
        [
          entry.timestamp, entry.provider || null, entry.model || null,
          entry.connectionId || null, entry.apiKey || null,
          promptTokens, completionTokens,
        ]
      );

      if (existing) {
        if (!existing.endpoint && entry.endpoint) {
          db.run(`UPDATE usageHistory SET endpoint = ? WHERE id = ?`, [entry.endpoint, existing.id]);
        }
        return;
      }

      db.run(
        `INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, status, tokens, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.timestamp, entry.provider || null, entry.model || null,
          entry.connectionId || null, entry.apiKey || null, entry.endpoint || null,
          promptTokens, completionTokens, entry.cost || 0, entry.status || "ok",
          stringifyJson(tokens), stringifyJson({}),
        ]
      );

      const dateKey = getLocalDateKey(entry.timestamp);
      const row = db.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, [dateKey]);
      const day = row ? parseJson(row.data, {}) : {
        requests: 0, promptTokens: 0, completionTokens: 0, cost: 0,
        byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {},
      };
      aggregateEntryToDay(day, entry);
      db.run(`INSERT INTO usageDaily(dateKey, data) VALUES(?, ?) ON CONFLICT(dateKey) DO UPDATE SET data = excluded.data`, [dateKey, stringifyJson(day)]);

      // Atomic counter increment in same transaction
      const cur = db.get(`SELECT value FROM _meta WHERE key = 'totalRequestsLifetime'`);
      const next = (cur ? parseInt(cur.value, 10) : 0) + 1;
      db.run(`INSERT INTO _meta(key, value) VALUES('totalRequestsLifetime', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(next)]);
      inserted = true;
    });

    if (inserted) {
      pushToRing(entry);
      scheduleStatsEvent("update", 250);
      if (entry.cost > 0 && entry.apiKey) {
        debitOwnerForApiKeyUsage(entry.apiKey, entry.cost, {
          provider: entry.provider || null,
          model: entry.model || null,
          endpoint: entry.endpoint || null,
        }).catch((err) => {
          console.error("Failed to debit account credit:", err?.message || err);
        });
      }
    }
  } catch (e) {
    console.error("Failed to save usage stats:", e);
  }
}

/** Map an upstream HTTP status onto the taxonomy `normalizeUsageStatus` reads. */
export function classifyFailureStatus(statusCode) {
  const code = Number(statusCode);
  if (code === 429) return "rate_limited";
  if (Number.isFinite(code) && code > 0) return `error_${code}`;
  return "error";
}

/**
 * Record a failed request so success-rate readouts reflect reality.
 *
 * Until this existed, `usageHistory` only ever received successful requests
 * (`saveUsageStats` bails when both token counts are zero and is never reached
 * on an error path), which made every `byStatus` readout a structural 100%
 * success.
 *
 * The row is aggregated into `usageDaily` and the lifetime counter exactly like
 * a successful one, because `totalRequests` is summed from `usageHistory` for
 * short periods but from `usageDaily` for long ones — updating only one of them
 * would make the same number disagree with itself depending on the range.
 * Tokens and cost are zero, so the token/spend tiles are untouched; only the
 * request count grows, which is correct: a failed call is still a call made.
 */
export async function saveRequestFailure(entry = {}) {
  try {
    const db = await getAdapter();
    const timestamp = entry.timestamp || new Date().toISOString();
    const status = entry.status || classifyFailureStatus(entry.statusCode);

    db.transaction(() => {
      // A retried attempt can land on the same millisecond as its predecessor;
      // dedupe on the full identity so one failure is not counted twice.
      const existing = db.get(
        `SELECT id FROM usageHistory
         WHERE timestamp = ?
           AND COALESCE(provider, '') = COALESCE(?, '')
           AND COALESCE(model, '') = COALESCE(?, '')
           AND COALESCE(connectionId, '') = COALESCE(?, '')
           AND COALESCE(apiKey, '') = COALESCE(?, '')
           AND COALESCE(status, '') = COALESCE(?, '')
         LIMIT 1`,
        [
          timestamp, entry.provider || null, entry.model || null,
          entry.connectionId || null, entry.apiKey || null, status,
        ],
      );
      if (existing) return;

      db.run(
        `INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, status, tokens, meta) VALUES(?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)`,
        [
          timestamp, entry.provider || null, entry.model || null,
          entry.connectionId || null, entry.apiKey || null, entry.endpoint || null,
          status,
          stringifyJson({}),
          stringifyJson({
            failure: true,
            statusCode: Number(entry.statusCode) || null,
            message: typeof entry.message === "string" ? entry.message.slice(0, 500) : null,
          }),
        ],
      );

      const dayEntry = {
        provider: entry.provider,
        model: entry.model,
        connectionId: entry.connectionId,
        apiKey: entry.apiKey,
        endpoint: entry.endpoint,
        tokens: {},
        cost: 0,
      };
      const dateKey = getLocalDateKey(timestamp);
      const row = db.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, [dateKey]);
      const day = row ? parseJson(row.data, {}) : {
        requests: 0, promptTokens: 0, completionTokens: 0, cost: 0,
        byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {},
      };
      aggregateEntryToDay(day, dayEntry);
      db.run(`INSERT INTO usageDaily(dateKey, data) VALUES(?, ?) ON CONFLICT(dateKey) DO UPDATE SET data = excluded.data`, [dateKey, stringifyJson(day)]);

      const cur = db.get(`SELECT value FROM _meta WHERE key = 'totalRequestsLifetime'`);
      const next = (cur ? parseInt(cur.value, 10) : 0) + 1;
      db.run(`INSERT INTO _meta(key, value) VALUES('totalRequestsLifetime', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(next)]);
    });

    scheduleStatsEvent("update", 250);
  } catch (e) {
    // Telemetry must never break the request it is describing.
    console.error("Failed to save request failure:", e?.message || e);
  }
}

const DEFAULT_USAGE_RETENTION_DAYS = 180;
const PRUNE_BATCH = 5000;

/**
 * Drop per-request usage rows older than the retention window.
 *
 * `usageHistory` had no delete path at all — one row per request, four indexes,
 * kept forever. The daily rollup in `usageDaily` is what every chart and total
 * actually reads for older windows, and it is tiny (one row per day), so the
 * raw rows can age out without losing any headline number. Only per-request
 * drill-down beyond the window is lost.
 *
 * Deletes in batches so a first run on a large table cannot hold one long write
 * lock. Returns the number of rows removed.
 */
export async function pruneUsageHistory({ retentionDays, vacuum = false } = {}) {
  let days = retentionDays;
  if (!Number.isFinite(days)) {
    try {
      const { getSettings } = await import("./settingsRepo.js");
      const settings = await getSettings();
      days = Number(settings?.usageRetentionDays);
    } catch {
      days = DEFAULT_USAGE_RETENTION_DAYS;
    }
  }
  if (!Number.isFinite(days)) days = DEFAULT_USAGE_RETENTION_DAYS;
  if (days <= 0) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const db = await getAdapter();
  let removed = 0;

  try {
    for (;;) {
      let batch = 0;
      db.transaction(() => {
        const rows = db.all(
          `SELECT id FROM usageHistory WHERE timestamp < ? ORDER BY timestamp ASC LIMIT ?`,
          [cutoff, PRUNE_BATCH],
        );
        if (!rows.length) return;
        const placeholders = rows.map(() => "?").join(", ");
        db.run(`DELETE FROM usageHistory WHERE id IN (${placeholders})`, rows.map((r) => r.id));
        batch = rows.length;
      });
      if (!batch) break;
      removed += batch;
      if (batch < PRUNE_BATCH) break;
    }

    // SQLite never returns freed pages to the filesystem on its own, so a prune
    // that deletes hundreds of thousands of rows otherwise shrinks nothing.
    if (removed > 0 && vacuum) {
      try {
        db.exec("VACUUM");
      } catch (e) {
        console.warn("[usageRepo] VACUUM after prune failed:", e?.message || e);
      }
    }
  } catch (e) {
    console.error("[usageRepo] usageHistory prune failed:", e?.message || e);
  }

  if (removed > 0) console.log(`[usageRepo] pruned ${removed} usageHistory rows older than ${days}d`);
  return removed;
}

export async function getUsageHistory(filter = {}) {
  const db = await getAdapter();
  const conds = [];
  const params = [];

  if (filter.provider) { conds.push("provider = ?"); params.push(filter.provider); }
  if (filter.model) { conds.push("model = ?"); params.push(filter.model); }
  if (filter.startDate) { conds.push("timestamp >= ?"); params.push(new Date(filter.startDate).toISOString()); }
  if (filter.endDate) { conds.push("timestamp <= ?"); params.push(new Date(filter.endDate).toISOString()); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db.all(`SELECT timestamp, provider, model, connectionId, apiKey, endpoint, cost, status, tokens FROM usageHistory ${where} ORDER BY id ASC`, params);

  return rows.map((r) => ({
    timestamp: r.timestamp, provider: r.provider, model: r.model,
    connectionId: r.connectionId, apiKeyMasked: maskApiKey(r.apiKey), endpoint: r.endpoint,
    cost: r.cost, status: r.status, tokens: parseJson(r.tokens, {}),
  }));
}

function loadDaysInRange(adapter, maxDays) {
  if (maxDays == null) {
    return adapter.all(`SELECT dateKey, data FROM usageDaily`);
  }
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - maxDays + 1);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  return adapter.all(`SELECT dateKey, data FROM usageDaily WHERE dateKey >= ?`, [cutoffKey]);
}

/** Period → ISO cutoff (null = no lower bound / all time). */
function getPeriodCutoffIso(period) {
  if (period === "all") return null;
  if (period === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay.toISOString();
  }
  const ms = PERIOD_MS[period];
  if (!ms) return null;
  return new Date(Date.now() - ms).toISOString();
}

/**
 * apiKeyFilter: null = all keys; "__local__" = no key; string = one exact key;
 * string[] = any key in the account.
 * @param {string} [opts.column="apiKey"] column / qualified name (e.g. "uh.apiKey")
 */
function buildApiKeyClause(apiKeyFilter, { leadingAnd = true, column = "apiKey" } = {}) {
  if (apiKeyFilter == null || apiKeyFilter === "") {
    return { clause: "", params: [] };
  }
  const prefix = leadingAnd ? " AND " : "";
  if (Array.isArray(apiKeyFilter)) {
    if (apiKeyFilter.length === 0) return { clause: `${prefix}1=0`, params: [] };
    const placeholders = apiKeyFilter.map(() => "?").join(", ");
    return { clause: `${prefix}${column} IN (${placeholders})`, params: apiKeyFilter };
  }
  if (apiKeyFilter === "__local__") {
    return { clause: `${prefix}(${column} IS NULL OR ${column} = '')`, params: [] };
  }
  if (apiKeyFilter === "__none__") {
    return { clause: `${prefix}1=0`, params: [] };
  }
  return { clause: `${prefix}${column} = ?`, params: [apiKeyFilter] };
}

function normalizeUsageStatus(status) {
  const raw = String(status || "ok").trim().toLowerCase();
  if (!raw || raw === "ok" || raw === "success") return "success";
  if (raw.includes("429") || raw.includes("rate")) return "rate_limited";
  if (raw.includes("fail") || raw.includes("error") || raw === "error") return "error";
  return "other";
}

function percentileSorted(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

const CHART_STACK_COLORS = [
  "#7c3aed", "#16a34a", "#f59e0b", "#2563eb", "#dc2626", "#71717a",
];

function attachQualityAndUserStats(stats, db, period, apiKeyFilter, apiKeyMap = {}) {
  const cutoff = getPeriodCutoffIso(period);

  // --- status + byUser from usageHistory ---
  const histConds = [];
  const histParams = [];
  if (cutoff) {
    histConds.push("uh.timestamp >= ?");
    histParams.push(cutoff);
  }
  const histAk = buildApiKeyClause(apiKeyFilter, { leadingAnd: false, column: "uh.apiKey" });
  if (histAk.clause) {
    histConds.push(histAk.clause);
    histParams.push(...histAk.params);
  }
  const histWhere = histConds.length ? `WHERE ${histConds.join(" AND ")}` : "";

  const statusRows = db.all(
    `SELECT uh.status AS status, COUNT(*) AS count
       FROM usageHistory uh
       ${histWhere}
      GROUP BY uh.status`,
    histParams,
  );
  const byStatus = { success: 0, error: 0, rate_limited: 0, other: 0 };
  for (const row of statusRows) {
    byStatus[normalizeUsageStatus(row.status)] += Number(row.count) || 0;
  }
  stats.byStatus = byStatus;

  const userRows = db.all(
    `SELECT
        CASE
          WHEN u.id IS NOT NULL THEN u.id
          WHEN uh.apiKey IS NULL OR uh.apiKey = '' THEN '__local__'
          ELSE '__unassigned__'
        END AS userId,
        COALESCE(u.username,
          CASE
            WHEN uh.apiKey IS NULL OR uh.apiKey = '' THEN 'Local / system'
            ELSE 'Unassigned key'
          END
        ) AS username,
        COALESCE(u.email, '') AS email,
        COUNT(*) AS requests,
        COALESCE(SUM(uh.promptTokens), 0) AS promptTokens,
        COALESCE(SUM(uh.completionTokens), 0) AS completionTokens,
        COALESCE(SUM(uh.cost), 0) AS cost,
        MAX(uh.timestamp) AS lastUsed
       FROM usageHistory uh
       LEFT JOIN apiKeys ak ON ak.key = uh.apiKey
       LEFT JOIN users u ON u.id = ak.ownerUserId
       ${histWhere}
      GROUP BY userId
      ORDER BY requests DESC`,
    histParams,
  );
  stats.byUser = {};
  for (const row of userRows) {
    stats.byUser[row.userId] = {
      userId: row.userId,
      username: row.username,
      email: row.email || "",
      requests: Number(row.requests) || 0,
      promptTokens: Number(row.promptTokens) || 0,
      completionTokens: Number(row.completionTokens) || 0,
      cachedTokens: 0,
      cost: Number(row.cost) || 0,
      lastUsed: row.lastUsed || null,
    };
  }

  // --- latency p50/p95 from requestDetails ---
  const detConds = [];
  const detParams = [];
  if (cutoff) {
    detConds.push("rd.timestamp >= ?");
    detParams.push(cutoff);
  }
  const detAk = buildApiKeyClause(apiKeyFilter, { leadingAnd: false, column: "rd.apiKey" });
  if (detAk.clause) {
    detConds.push(detAk.clause);
    detParams.push(...detAk.params);
  }
  const detWhere = detConds.length ? `WHERE ${detConds.join(" AND ")}` : "";
  const latencyRows = db.all(
    `SELECT
        rd.status AS status,
        CASE
          WHEN json_valid(rd.data)
          THEN CAST(json_extract(rd.data, '$.latency.total') AS REAL)
          ELSE NULL
        END AS totalMs
       FROM requestDetails rd
       ${detWhere}`,
    detParams,
  );

  const allLat = [];
  const okLat = [];
  const errLat = [];
  for (const row of latencyRows) {
    const bucket = normalizeUsageStatus(row.status);
    const ms = Number(row.totalMs);
    if (!Number.isFinite(ms) || ms < 0) continue;
    allLat.push(ms);
    if (bucket === "success") okLat.push(ms);
    else if (bucket === "error" || bucket === "rate_limited") errLat.push(ms);
  }
  allLat.sort((a, b) => a - b);
  okLat.sort((a, b) => a - b);
  errLat.sort((a, b) => a - b);

  const mkLat = (arr) => ({
    count: arr.length,
    p50: percentileSorted(arr, 0.5),
    p95: percentileSorted(arr, 0.95),
    avg: arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null,
  });
  stats.latency = {
    all: mkLat(allLat),
    success: mkLat(okLat),
    error: mkLat(errLat),
  };
}

function emptyChartBucket(label) {
  return { label, tokens: 0, cost: 0, requests: 0, promptTokens: 0, completionTokens: 0, byModel: {} };
}

/** groupKey: usually the model id (falls back to provider, then "unknown"). */
function addChartSample(bucket, groupKey, promptTokens, completionTokens, cost) {
  const p = Number(promptTokens) || 0;
  const c2 = Number(completionTokens) || 0;
  const t = p + c2;
  const cost2 = Number(cost) || 0;
  bucket.tokens += t;
  bucket.cost += cost2;
  bucket.requests += 1;
  bucket.promptTokens += p;
  bucket.completionTokens += c2;
  const key = groupKey || "unknown";
  if (!bucket.byModel[key]) bucket.byModel[key] = { tokens: 0, cost: 0, requests: 0 };
  bucket.byModel[key].tokens += t;
  bucket.byModel[key].cost += cost2;
  bucket.byModel[key].requests += 1;
}

function finalizeChartBuckets(buckets, topN = 5) {
  const totals = {};
  for (const b of buckets) {
    for (const [id, vals] of Object.entries(b.byModel || {})) {
      if (!totals[id]) totals[id] = 0;
      totals[id] += vals.requests || 0;
    }
  }
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, topN).map(([id]) => id);
  const topSet = new Set(top);
  const hasOther = ranked.some(([id]) => !topSet.has(id));
  const stackKeys = hasOther ? [...top, "other"] : top;

  const points = buckets.map((b) => {
    const point = {
      label: b.label,
      tokens: b.tokens || 0,
      cost: b.cost || 0,
      requests: b.requests || 0,
      promptTokens: b.promptTokens || 0,
      completionTokens: b.completionTokens || 0,
    };
    for (const key of stackKeys) {
      point[`t_${key}`] = 0;
      point[`c_${key}`] = 0;
      point[`r_${key}`] = 0;
    }
    for (const [id, vals] of Object.entries(b.byModel || {})) {
      const key = topSet.has(id) ? id : "other";
      if (!stackKeys.includes(key)) continue;
      point[`t_${key}`] += vals.tokens || 0;
      point[`c_${key}`] += vals.cost || 0;
      point[`r_${key}`] += vals.requests || 0;
    }
    return point;
  });

  const series = stackKeys.map((id, i) => ({
    id,
    name: id === "other" ? "Other" : id,
    color: CHART_STACK_COLORS[i % CHART_STACK_COLORS.length],
  }));

  return { points, series };
}

export async function getUsageStats(period = "all", options = {}) {
  const apiKeyFilter = options.apiKeyFilter ?? null;
  const db = await getAdapter();

  const [{ getProviderConnections }, { getApiKeys }, { getProviderNodes }] = await Promise.all([
    import("./connectionsRepo.js"),
    import("./apiKeysRepo.js"),
    import("./nodesRepo.js"),
  ]);

  let allConnections = [];
  try { allConnections = await getProviderConnections(); } catch {}
  const connectionMap = {};
  for (const c of allConnections) connectionMap[c.id] = c.name || c.email || c.id;

  const providerNodeNameMap = {};
  try {
    const nodes = await getProviderNodes();
    for (const n of nodes) if (n.id && n.name) providerNodeNameMap[n.id] = n.name;
  } catch {}

  let allApiKeys = [];
  try { allApiKeys = await getApiKeys(); } catch {}
  const apiKeyMap = {};
  for (const k of allApiKeys) apiKeyMap[k.key] = { name: k.name, id: k.id, createdAt: k.createdAt };

  // recentRequests from live history (last 100 entries enough for 20 deduped)
  const recentAk = buildApiKeyClause(apiKeyFilter, { leadingAnd: false });
  const recentSql = recentAk.clause
    ? `SELECT timestamp, provider, model, tokens, status, apiKey FROM usageHistory WHERE ${recentAk.clause} ORDER BY id DESC LIMIT 200`
    : `SELECT timestamp, provider, model, tokens, status, apiKey FROM usageHistory ORDER BY id DESC LIMIT 100`;
  const recentRows = db.all(recentSql, recentAk.params);
  const seen = new Set();
  const recentRequests = recentRows
    .map((r) => {
      const t = parseJson(r.tokens, {}) || {};
      return {
        timestamp: r.timestamp, model: r.model, provider: r.provider || "",
        promptTokens: t.prompt_tokens || t.input_tokens || 0,
        completionTokens: t.completion_tokens || t.output_tokens || 0,
        cachedTokens: t.cached_tokens || t.cache_read_input_tokens || 0,
        status: r.status || "ok",
      };
    })
    .filter((e) => {
      if (e.promptTokens === 0 && e.completionTokens === 0) return false;
      const minute = e.timestamp ? e.timestamp.slice(0, 16) : "";
      const key = `${e.model}|${e.provider}|${e.promptTokens}|${e.completionTokens}|${minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);

  const stats = {
    totalRequests: 0,
    totalPromptTokens: 0, totalCompletionTokens: 0, totalCachedTokens: 0, totalCost: 0,
    byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {},
    last10Minutes: [],
    pending: pendingRequests,
    activeRequests: [],
    recentRequests,
    errorProvider: (Date.now() - lastErrorProvider.ts < 10000) ? lastErrorProvider.provider : "",
  };

  // Active requests
  for (const [connectionId, models] of Object.entries(pendingRequests.byAccount)) {
    for (const [modelKey, count] of Object.entries(models)) {
      if (count > 0) {
        const accountName = connectionMap[connectionId] || `Account ${connectionId.slice(0, 8)}...`;
        const match = modelKey.match(/^(.*) \((.*)\)$/);
        stats.activeRequests.push({
          model: match ? match[1] : modelKey,
          provider: match ? match[2] : "unknown",
          account: accountName, count,
        });
      }
    }
  }

  // last10Minutes — query 10min window
  const now = new Date();
  const currentMinuteStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const tenMinutesAgo = new Date(currentMinuteStart.getTime() - 9 * 60 * 1000);
  const bucketMap = {};
  for (let i = 0; i < 10; i++) {
    const ts = currentMinuteStart.getTime() - (9 - i) * 60 * 1000;
    bucketMap[ts] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
    stats.last10Minutes.push(bucketMap[ts]);
  }
  const last10Ak = buildApiKeyClause(apiKeyFilter);
  const recent10 = db.all(
    `SELECT timestamp, promptTokens, completionTokens, cost FROM usageHistory WHERE timestamp >= ? AND timestamp <= ?${last10Ak.clause}`,
    [tenMinutesAgo.toISOString(), now.toISOString(), ...last10Ak.params]
  );
  for (const r of recent10) {
    const tt = new Date(r.timestamp).getTime();
    const minuteStart = Math.floor(tt / 60000) * 60000;
    if (bucketMap[minuteStart]) {
      bucketMap[minuteStart].requests++;
      bucketMap[minuteStart].promptTokens += r.promptTokens || 0;
      bucketMap[minuteStart].completionTokens += r.completionTokens || 0;
      bucketMap[minuteStart].cost += r.cost || 0;
    }
  }

  // Daily summary is fast but only valid for whole-day windows; sub-day/odd periods
  // (5m/15m/1h/6h/12h/24h/3d/14d/today) fall through to the live usageHistory scan below.
  // When an API key filter is active, always aggregate from usageHistory.
  const DAILY_SUMMARY_PERIODS = new Set(["7d", "30d", "60d", "all"]);
  const useDailySummary = !apiKeyFilter
    && options.forceHistory !== true
    && DAILY_SUMMARY_PERIODS.has(period);

  if (useDailySummary) {
    // "all" → maxDays null → load every usageDaily row (stats API already accepts "all")
    const periodDays = { "7d": 7, "30d": 30, "60d": 60 };
    const maxDays = period === "all" ? null : (periodDays[period] || null);
    const dayRows = loadDaysInRange(db, maxDays);

    for (const dr of dayRows) {
      const dateKey = dr.dateKey;
      const day = parseJson(dr.data, {});
      stats.totalPromptTokens += day.promptTokens || 0;
      stats.totalCompletionTokens += day.completionTokens || 0;
      stats.totalCachedTokens += day.cachedTokens || 0;
      stats.totalCost += day.cost || 0;

      for (const [prov, p] of Object.entries(day.byProvider || {})) {
        if (!stats.byProvider[prov]) stats.byProvider[prov] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, lastUsed: dateKey };
        stats.byProvider[prov].requests += p.requests || 0;
        stats.byProvider[prov].promptTokens += p.promptTokens || 0;
        stats.byProvider[prov].completionTokens += p.completionTokens || 0;
        stats.byProvider[prov].cachedTokens += p.cachedTokens || 0;
        stats.byProvider[prov].cost += p.cost || 0;
        if (dateKey > (stats.byProvider[prov].lastUsed || "")) stats.byProvider[prov].lastUsed = dateKey;
      }

      for (const [mk, m] of Object.entries(day.byModel || {})) {
        const rawModel = m.rawModel || mk.split("|")[0];
        const provider = m.provider || mk.split("|")[1] || "";
        const statsKey = provider ? `${rawModel} (${provider})` : rawModel;
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        if (!stats.byModel[statsKey]) {
          stats.byModel[statsKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel, provider: providerDisplayName, lastUsed: dateKey };
        }
        stats.byModel[statsKey].requests += m.requests || 0;
        stats.byModel[statsKey].promptTokens += m.promptTokens || 0;
        stats.byModel[statsKey].completionTokens += m.completionTokens || 0;
        stats.byModel[statsKey].cachedTokens += m.cachedTokens || 0;
        stats.byModel[statsKey].cost += m.cost || 0;
        if (dateKey > (stats.byModel[statsKey].lastUsed || "")) stats.byModel[statsKey].lastUsed = dateKey;
      }

      for (const [connId, a] of Object.entries(day.byAccount || {})) {
        const accountName = connectionMap[connId] || `Account ${connId.slice(0, 8)}...`;
        const rawModel = a.rawModel || "";
        const provider = a.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        const accountKey = `${rawModel} (${provider} - ${accountName})`;
        if (!stats.byAccount[accountKey]) {
          stats.byAccount[accountKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel, provider: providerDisplayName, connectionId: connId, accountName, lastUsed: dateKey };
        }
        stats.byAccount[accountKey].requests += a.requests || 0;
        stats.byAccount[accountKey].promptTokens += a.promptTokens || 0;
        stats.byAccount[accountKey].completionTokens += a.completionTokens || 0;
        stats.byAccount[accountKey].cachedTokens += a.cachedTokens || 0;
        stats.byAccount[accountKey].cost += a.cost || 0;
        if (dateKey > (stats.byAccount[accountKey].lastUsed || "")) stats.byAccount[accountKey].lastUsed = dateKey;
      }

      for (const [akKey, ak] of Object.entries(day.byApiKey || {})) {
        const rawModel = ak.rawModel || "";
        const provider = ak.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        const apiKeyVal = ak.apiKey;
        const keyInfo = apiKeyVal ? apiKeyMap[apiKeyVal] : null;
        const keyName = keyInfo?.name || (apiKeyVal ? apiKeyVal.slice(0, 8) + "..." : "Local (No API Key)");
        const apiKeyMasked = maskApiKey(apiKeyVal);
        const apiKeyKey = apiKeyMasked || "local-no-key";
        if (!stats.byApiKey[akKey]) {
          stats.byApiKey[akKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel, provider: providerDisplayName, apiKeyMasked, keyName, apiKeyKey, lastUsed: dateKey };
        }
        stats.byApiKey[akKey].requests += ak.requests || 0;
        stats.byApiKey[akKey].promptTokens += ak.promptTokens || 0;
        stats.byApiKey[akKey].completionTokens += ak.completionTokens || 0;
        stats.byApiKey[akKey].cachedTokens += ak.cachedTokens || 0;
        stats.byApiKey[akKey].cost += ak.cost || 0;
        if (dateKey > (stats.byApiKey[akKey].lastUsed || "")) stats.byApiKey[akKey].lastUsed = dateKey;
      }

      for (const [epKey, ep] of Object.entries(day.byEndpoint || {})) {
        const endpoint = ep.endpoint || epKey.split("|")[0] || "Unknown";
        const rawModel = ep.rawModel || "";
        const provider = ep.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        if (!stats.byEndpoint[epKey]) {
          stats.byEndpoint[epKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, endpoint, rawModel, provider: providerDisplayName, lastUsed: dateKey };
        }
        stats.byEndpoint[epKey].requests += ep.requests || 0;
        stats.byEndpoint[epKey].promptTokens += ep.promptTokens || 0;
        stats.byEndpoint[epKey].completionTokens += ep.completionTokens || 0;
        stats.byEndpoint[epKey].cachedTokens += ep.cachedTokens || 0;
        stats.byEndpoint[epKey].cost += ep.cost || 0;
        if (dateKey > (stats.byEndpoint[epKey].lastUsed || "")) stats.byEndpoint[epKey].lastUsed = dateKey;
      }
    }

    // Overlay precise lastUsed timestamps from history
    const overlayCutoff = maxDays ? Date.now() - maxDays * 86400000 : 0;
    const histRows = db.all(
      `SELECT timestamp, provider, model, connectionId, apiKey, endpoint FROM usageHistory WHERE timestamp >= ?`,
      [new Date(overlayCutoff).toISOString()]
    );
    for (const e of histRows) {
      const ts = e.timestamp;
      const modelKey = e.provider ? `${e.model} (${e.provider})` : e.model;
      if (stats.byModel[modelKey] && new Date(ts) > new Date(stats.byModel[modelKey].lastUsed)) stats.byModel[modelKey].lastUsed = ts;

      if (e.connectionId) {
        const accountName = connectionMap[e.connectionId] || `Account ${e.connectionId.slice(0, 8)}...`;
        const accountKey = `${e.model} (${e.provider} - ${accountName})`;
        if (stats.byAccount[accountKey] && new Date(ts) > new Date(stats.byAccount[accountKey].lastUsed)) stats.byAccount[accountKey].lastUsed = ts;
      }

      const apiKeyKey = (e.apiKey && typeof e.apiKey === "string")
        ? `${e.apiKey}|${e.model}|${e.provider || "unknown"}`
        : "local-no-key";
      if (stats.byApiKey[apiKeyKey] && new Date(ts) > new Date(stats.byApiKey[apiKeyKey].lastUsed)) stats.byApiKey[apiKeyKey].lastUsed = ts;

      const endpoint = e.endpoint || "Unknown";
      const endpointKey = `${endpoint}|${e.model}|${e.provider || "unknown"}`;
      if (stats.byEndpoint[endpointKey] && new Date(ts) > new Date(stats.byEndpoint[endpointKey].lastUsed)) stats.byEndpoint[endpointKey].lastUsed = ts;
    }
  } else {
    // 24h / today / (any period with apiKey filter): live history
    const cutoff = getPeriodCutoffIso(period);
    const conds = [];
    const params = [];
    if (cutoff) {
      conds.push("timestamp >= ?");
      params.push(cutoff);
    }
    const historyAk = buildApiKeyClause(apiKeyFilter, { leadingAnd: false });
    if (historyAk.clause) {
      conds.push(historyAk.clause);
      params.push(...historyAk.params);
    }
    const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
    const filtered = db.all(
      `SELECT timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, tokens FROM usageHistory${where}`,
      params
    );

    for (const r of filtered) {
      const tokens = parseJson(r.tokens, {}) || {};
      const promptTokens = tokens.prompt_tokens || 0;
      const completionTokens = tokens.completion_tokens || 0;
      const cachedTokens = tokens.cached_tokens || tokens.cache_read_input_tokens || 0;
      const entryCost = r.cost || 0;
      const providerDisplayName = providerNodeNameMap[r.provider] || r.provider;

      stats.totalPromptTokens += promptTokens;
      stats.totalCompletionTokens += completionTokens;
      stats.totalCachedTokens += cachedTokens;
      stats.totalCost += entryCost;

      if (!stats.byProvider[r.provider]) stats.byProvider[r.provider] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, lastUsed: r.timestamp };
      stats.byProvider[r.provider].requests++;
      stats.byProvider[r.provider].promptTokens += promptTokens;
      stats.byProvider[r.provider].completionTokens += completionTokens;
      stats.byProvider[r.provider].cachedTokens += cachedTokens;
      stats.byProvider[r.provider].cost += entryCost;
      if (new Date(r.timestamp) > new Date(stats.byProvider[r.provider].lastUsed || 0)) {
        stats.byProvider[r.provider].lastUsed = r.timestamp;
      }

      const modelKey = r.provider ? `${r.model} (${r.provider})` : r.model;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel: r.model, provider: providerDisplayName, lastUsed: r.timestamp };
      }
      stats.byModel[modelKey].requests++;
      stats.byModel[modelKey].promptTokens += promptTokens;
      stats.byModel[modelKey].completionTokens += completionTokens;
      stats.byModel[modelKey].cachedTokens += cachedTokens;
      stats.byModel[modelKey].cost += entryCost;
      if (new Date(r.timestamp) > new Date(stats.byModel[modelKey].lastUsed)) stats.byModel[modelKey].lastUsed = r.timestamp;

      if (r.connectionId) {
        const accountName = connectionMap[r.connectionId] || `Account ${r.connectionId.slice(0, 8)}...`;
        const accountKey = `${r.model} (${r.provider} - ${accountName})`;
        if (!stats.byAccount[accountKey]) {
          stats.byAccount[accountKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel: r.model, provider: providerDisplayName, connectionId: r.connectionId, accountName, lastUsed: r.timestamp };
        }
        stats.byAccount[accountKey].requests++;
        stats.byAccount[accountKey].promptTokens += promptTokens;
        stats.byAccount[accountKey].completionTokens += completionTokens;
        stats.byAccount[accountKey].cachedTokens += cachedTokens;
        stats.byAccount[accountKey].cost += entryCost;
        if (new Date(r.timestamp) > new Date(stats.byAccount[accountKey].lastUsed)) stats.byAccount[accountKey].lastUsed = r.timestamp;
      }

      if (r.apiKey && typeof r.apiKey === "string") {
        const keyInfo = apiKeyMap[r.apiKey];
        const keyName = keyInfo?.name || r.apiKey.slice(0, 8) + "...";
        const apiKeyMasked = maskApiKey(r.apiKey);
        const akKey = `${apiKeyMasked}|${r.model}|${r.provider || "unknown"}`;
        if (!stats.byApiKey[akKey]) {
          stats.byApiKey[akKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel: r.model, provider: providerDisplayName, apiKeyMasked, keyName, apiKeyKey: apiKeyMasked, lastUsed: r.timestamp };
        }
        const ake = stats.byApiKey[akKey];
        ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cachedTokens += cachedTokens; ake.cost += entryCost;
        if (new Date(r.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = r.timestamp;
      } else {
        if (!stats.byApiKey["local-no-key"]) {
          stats.byApiKey["local-no-key"] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, rawModel: r.model, provider: providerDisplayName, apiKeyMasked: null, keyName: "Local (No API Key)", apiKeyKey: "local-no-key", lastUsed: r.timestamp };
        }
        const ake = stats.byApiKey["local-no-key"];
        ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cachedTokens += cachedTokens; ake.cost += entryCost;
        if (new Date(r.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = r.timestamp;
      }

      const endpoint = r.endpoint || "Unknown";
      const epKey = `${endpoint}|${r.model}|${r.provider || "unknown"}`;
      if (!stats.byEndpoint[epKey]) {
        stats.byEndpoint[epKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: 0, endpoint, rawModel: r.model, provider: providerDisplayName, lastUsed: r.timestamp };
      }
      const epe = stats.byEndpoint[epKey];
      epe.requests++; epe.promptTokens += promptTokens; epe.completionTokens += completionTokens; epe.cachedTokens += cachedTokens; epe.cost += entryCost;
      if (new Date(r.timestamp) > new Date(epe.lastUsed)) epe.lastUsed = r.timestamp;
    }
  }

  stats.totalRequests = Object.values(stats.byProvider).reduce((sum, p) => sum + (p.requests || 0), 0);

  // Enrich provider rows with display name for table view.
  for (const [provId, row] of Object.entries(stats.byProvider)) {
    row.providerId = provId;
    row.provider = providerNodeNameMap[provId] || provId;
    row.rawModel = "—";
    if (!row.lastUsed) row.lastUsed = null;
  }

  attachQualityAndUserStats(stats, db, period, apiKeyFilter, apiKeyMap);
  return stats;
}

/**
 * Public model leaderboard: aggregate per-model usage across the whole system
 * inside one period window, ranked by requests (or total tokens).
 *
 * Same dual-source strategy as getUsageStats: whole-day windows (7d/30d/all)
 * read the forever-kept `usageDaily` rollups (`usageHistory` is pruned by
 * retention, so rollups are the only complete long-range source), while
 * sub-day windows scan the timestamp-indexed live history. For whole-day
 * windows the history query runs only as a lastUsed overlay — every insert
 * lands in both stores, so adding counts from both would double them.
 *
 * Deliberately excludes every user-identifying dimension (API key, owner,
 * connection/account) — this feeds an unauthenticated endpoint. Provider is
 * deliberately not a ranking dimension; matching model names share one row.
 *
 * @param {string} [period="7d"]
 * @param {{ sort?: "requests"|"tokens" }} [options]
 */
export async function getModelRanking(period = "7d", options = {}) {
  const db = await getAdapter();
  const sort = options.sort === "tokens" ? "tokens" : "requests";

  const acc = new Map();
  const bucketFor = (rawModel) => {
    let entry = acc.get(rawModel);
    if (!entry) {
      entry = {
        rawModel,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        cost: 0,
        lastUsed: "",
      };
      acc.set(rawModel, entry);
    }
    return entry;
  };

  const DAILY_SUMMARY_PERIODS = new Set(["7d", "30d", "all"]);
  if (DAILY_SUMMARY_PERIODS.has(period)) {
    const periodDays = { "7d": 7, "30d": 30 };
    const maxDays = period === "all" ? null : (periodDays[period] || null);
    for (const dr of loadDaysInRange(db, maxDays)) {
      const day = parseJson(dr.data, {});
      for (const [mk, m] of Object.entries(day.byModel || {})) {
        const rawModel = m.rawModel || mk.split("|")[0];
        const entry = bucketFor(rawModel);
        entry.requests += m.requests || 0;
        entry.promptTokens += m.promptTokens || 0;
        entry.completionTokens += m.completionTokens || 0;
        entry.cachedTokens += m.cachedTokens || 0;
        entry.cost += m.cost || 0;
        if (dr.dateKey > entry.lastUsed) entry.lastUsed = dr.dateKey;
      }
    }
  }

  // Live history contributes differently per source path:
  //  - sub-day windows: history IS the dataset (rollups are whole-day only);
  //  - whole-day windows: rollups are authoritative — history must NOT add
  //    counts again (every insert lands in both stores), it only refines
  //    lastUsed to precise timestamps.
  const cutoff = getPeriodCutoffIso(period);
  const histConds = [];
  const histParams = [];
  if (cutoff) {
    histConds.push("timestamp >= ?");
    histParams.push(cutoff);
  }
  const histWhere = histConds.length ? `WHERE ${histConds.join(" AND ")}` : "";
  const histRows = db.all(
    `SELECT timestamp, model, promptTokens, completionTokens, cost, tokens
       FROM usageHistory ${histWhere}`,
    histParams,
  );
  for (const r of histRows) {
    const entry = bucketFor(r.model || "unknown");

    if (!DAILY_SUMMARY_PERIODS.has(period)) {
      const tokens = parseJson(r.tokens, {}) || {};
      // Canonical columns are always written on insert; the JSON blob only
      // matters as a fallback (cached tokens never get a column).
      const promptTokens = Number(r.promptTokens) || tokens.prompt_tokens || tokens.input_tokens || 0;
      const completionTokens = Number(r.completionTokens) || tokens.completion_tokens || tokens.output_tokens || 0;
      const cachedTokens = tokens.cached_tokens || tokens.cache_read_input_tokens || 0;

      entry.requests += 1;
      entry.promptTokens += promptTokens;
      entry.completionTokens += completionTokens;
      entry.cachedTokens += cachedTokens;
      entry.cost += r.cost || 0;
    }

    if (r.timestamp > entry.lastUsed) entry.lastUsed = r.timestamp;
  }

  const models = [...acc.values()]
    .filter((e) => e.requests > 0)
    .map((e) => ({
      rank: 0,
      model: e.rawModel,
      requests: e.requests,
      promptTokens: e.promptTokens,
      completionTokens: e.completionTokens,
      totalTokens: e.promptTokens + e.completionTokens,
      cachedTokens: e.cachedTokens,
      cost: e.cost,
      lastUsed: e.lastUsed || null,
    }));

  const scoreOf = sort === "tokens"
    ? (m) => m.totalTokens
    : (m) => m.requests;
  models.sort((a, b) => scoreOf(b) - scoreOf(a) || String(a.model).localeCompare(String(b.model)));
  models.forEach((m, i) => { m.rank = i + 1; });

  const totals = models.reduce(
    (sums, m) => ({
      requests: sums.requests + m.requests,
      promptTokens: sums.promptTokens + m.promptTokens,
      completionTokens: sums.completionTokens + m.completionTokens,
    }),
    { requests: 0, promptTokens: 0, completionTokens: 0 },
  );

  return {
    period,
    sort,
    generatedAt: new Date().toISOString(),
    totalRequests: totals.requests,
    totalPromptTokens: totals.promptTokens,
    totalCompletionTokens: totals.completionTokens,
    totalTokens: totals.promptTokens + totals.completionTokens,
    models,
  };
}

/**
 * One aggregate row per key-owning account: lifetime totals, windowed totals, and
 * last request timestamp. Cheap enough for the admin Accounts list, which needs
 * per-user activity without running the full `getUsageStats` pipeline per user.
 * @param {string} [period="30d"] window used for the `*InPeriod` fields
 * @returns {Promise<Record<string, object>>} keyed by userId
 */
export async function getUsageByOwner(period = "30d") {
  const db = await getAdapter();
  const cutoff = getPeriodCutoffIso(period) || "";
  const rows = db.all(
    `SELECT ak.ownerUserId AS userId,
            COUNT(*) AS requests,
            COALESCE(SUM(uh.promptTokens), 0) AS promptTokens,
            COALESCE(SUM(uh.completionTokens), 0) AS completionTokens,
            COALESCE(SUM(uh.cost), 0) AS cost,
            COALESCE(SUM(CASE WHEN uh.timestamp >= ? THEN 1 ELSE 0 END), 0) AS requestsInPeriod,
            COALESCE(SUM(CASE WHEN uh.timestamp >= ? THEN uh.cost ELSE 0 END), 0) AS costInPeriod,
            MAX(uh.timestamp) AS lastUsed
       FROM usageHistory uh
       JOIN apiKeys ak ON ak.key = uh.apiKey
      WHERE ak.ownerUserId IS NOT NULL
      GROUP BY ak.ownerUserId`,
    [cutoff, cutoff],
  );

  const byOwner = {};
  for (const row of rows) {
    byOwner[row.userId] = {
      userId: row.userId,
      requests: Number(row.requests) || 0,
      promptTokens: Number(row.promptTokens) || 0,
      completionTokens: Number(row.completionTokens) || 0,
      cost: Number(row.cost) || 0,
      requestsInPeriod: Number(row.requestsInPeriod) || 0,
      costInPeriod: Number(row.costInPeriod) || 0,
      lastUsed: row.lastUsed || null,
    };
  }
  return byOwner;
}

export async function getSystemUsageOverview(period = "today") {
  const db = await getAdapter();
  const cutoff = getPeriodCutoffIso(period);
  const where = cutoff ? "WHERE uh.timestamp >= ?" : "";
  const params = cutoff ? [cutoff] : [];

  // Cache columns live inside the JSON `tokens` blob rather than their own
  // columns, and providers disagree on the key (OpenAI-style `cached_tokens` vs
  // Claude-style `cache_read_input_tokens`), so both are folded here. Summed in
  // SQL — the alternative is scanning every row into JS just to add two numbers.
  const summary = db.get(
    `SELECT COUNT(*) AS requests,
            COALESCE(SUM(uh.promptTokens), 0) AS promptTokens,
            COALESCE(SUM(uh.completionTokens), 0) AS completionTokens,
            COALESCE(SUM(${CACHED_TOKENS_SQL("uh.tokens")}), 0) AS cachedTokens,
            COALESCE(SUM(${CACHE_WRITE_TOKENS_SQL("uh.tokens")}), 0) AS cacheCreationTokens,
            COALESCE(SUM(uh.cost), 0) AS cost
       FROM usageHistory uh ${where}`,
    params,
  ) || {};

  const userRows = db.all(
    `SELECT identity,
            MAX(username) AS username,
            MAX(email) AS email,
            GROUP_CONCAT(DISTINCT apiKeyName) AS apiKeyNames,
            COUNT(*) AS requests,
            COALESCE(SUM(promptTokens), 0) AS promptTokens,
            COALESCE(SUM(completionTokens), 0) AS completionTokens,
            COALESCE(SUM(cachedTokens), 0) AS cachedTokens,
            COALESCE(SUM(cacheCreationTokens), 0) AS cacheCreationTokens,
            COALESCE(SUM(cost), 0) AS cost,
            MAX(timestamp) AS lastRequest
       FROM (
         SELECT CASE
                  WHEN u.id IS NOT NULL THEN u.id
                  WHEN uh.apiKey IS NULL OR uh.apiKey = '' THEN '__local__'
                  ELSE '__unassigned__'
                END AS identity,
                COALESCE(u.username, CASE WHEN uh.apiKey IS NULL OR uh.apiKey = '' THEN 'Local / system' ELSE 'Unassigned key' END) AS username,
                COALESCE(u.email, '') AS email,
                COALESCE(ak.name, CASE WHEN uh.apiKey IS NULL OR uh.apiKey = '' THEN 'No API key' ELSE 'Unknown key' END) AS apiKeyName,
                uh.promptTokens,
                uh.completionTokens,
                ${CACHED_TOKENS_SQL("uh.tokens")} AS cachedTokens,
                ${CACHE_WRITE_TOKENS_SQL("uh.tokens")} AS cacheCreationTokens,
                uh.cost,
                uh.timestamp
           FROM usageHistory uh
           LEFT JOIN apiKeys ak ON ak.key = uh.apiKey
           LEFT JOIN users u ON u.id = ak.ownerUserId
           ${where}
       )
      GROUP BY identity
      ORDER BY requests DESC, username ASC`,
    params,
  );

  const keyRows = db.all(
    `SELECT ak.key, ak.name AS apiKeyName, u.id AS userId, u.username, u.email
       FROM apiKeys ak
       LEFT JOIN users u ON u.id = ak.ownerUserId`,
  );
  const keyMap = new Map(keyRows.map((row) => [row.key, row]));
  const activeByIdentity = new Map();
  for (const [key, models] of Object.entries(pendingRequestsByApiKey)) {
    const keyInfo = keyMap.get(key);
    const identity = keyInfo?.userId || (key === "__local__" ? "__local__" : "__unassigned__");
    const active = Object.values(models).reduce((sum, count) => sum + count, 0);
    if (active <= 0) continue;
    const current = activeByIdentity.get(identity) || {
      activeRequests: 0,
      username: keyInfo?.username || (identity === "__local__" ? "Local / system" : "Unassigned key"),
      email: keyInfo?.email || "",
      apiKeyName: keyInfo?.apiKeyName || (identity === "__local__" ? "No API key" : "Unknown key"),
    };
    current.activeRequests += active;
    activeByIdentity.set(identity, current);
  }

  const users = userRows.map((row) => ({
    id: row.identity,
    username: row.username,
    email: row.email,
    apiKeys: row.apiKeyNames ? row.apiKeyNames.split(",") : [],
    requests: row.requests || 0,
    activeRequests: activeByIdentity.get(row.identity)?.activeRequests || 0,
    promptTokens: row.promptTokens || 0,
    completionTokens: row.completionTokens || 0,
    cachedTokens: row.cachedTokens || 0,
    cacheCreationTokens: row.cacheCreationTokens || 0,
    cost: row.cost || 0,
    lastRequest: row.lastRequest,
  }));
  const knownUserIds = new Set(users.map((user) => user.id));
  for (const [identity, active] of activeByIdentity) {
    if (knownUserIds.has(identity)) continue;
    users.push({
      id: identity,
      username: active.username,
      email: active.email,
      apiKeys: [active.apiKeyName],
      requests: 0,
      activeRequests: active.activeRequests,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      cacheCreationTokens: 0,
      cost: 0,
      lastRequest: null,
    });
  }
  users.sort((a, b) => b.activeRequests - a.activeRequests || b.requests - a.requests);

  const { logs: recent } = await getRequestLogsPage({
    period,
    page: 1,
    pageSize: 50,
  });

  return {
    summary: {
      requests: summary.requests || 0,
      promptTokens: summary.promptTokens || 0,
      completionTokens: summary.completionTokens || 0,
      cachedTokens: summary.cachedTokens || 0,
      cacheCreationTokens: summary.cacheCreationTokens || 0,
      cost: summary.cost || 0,
      activeRequests: users.reduce((sum, user) => sum + user.activeRequests, 0),
      activeUsers: users.filter((user) => user.activeRequests > 0).length,
    },
    users,
    recent,
  };
}

function queryHistoryChartRows(db, startIso, apiKeyFilter) {
  const conds = [];
  const params = [];
  if (startIso) {
    conds.push("timestamp >= ?");
    params.push(startIso);
  }
  const historyAk = buildApiKeyClause(apiKeyFilter, { leadingAnd: false });
  if (historyAk.clause) {
    conds.push(historyAk.clause);
    params.push(...historyAk.params);
  }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  return db.all(
    `SELECT timestamp, provider, model, promptTokens, completionTokens, cost, apiKey FROM usageHistory${where}`,
    params
  );
}

function buildBucketsFromRows(rows, startTime, endTime, bucketCount, bucketMs, labelFn, clampLast = false) {
  const buckets = Array.from({ length: bucketCount }, (_, i) => emptyChartBucket(labelFn(startTime + i * bucketMs)));
  for (const r of rows) {
    const t = new Date(r.timestamp).getTime();
    if (t < startTime || t >= endTime) continue;
    let idx = Math.floor((t - startTime) / bucketMs);
    if (clampLast) idx = Math.min(idx, bucketCount - 1);
    if (idx < 0 || idx >= bucketCount) continue;
    addChartSample(
      buckets[idx],
      r.model || r.provider || "unknown",
      r.promptTokens || 0,
      r.completionTokens || 0,
      r.cost || 0,
    );
  }
  return buckets;
}

/**
 * Per-bucket time series for the selected period: overall requests/tokens/cost,
 * plus a top-N "by model" breakdown (t_/c_/r_ prefixed keys) for stacked series.
 */
export async function getChartData(period = "7d", options = {}) {
  const apiKeyFilter = options.apiKeyFilter ?? null;
  const db = await getAdapter();
  const now = Date.now();
  const hourLabel = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dayLabel = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (period === "today") {
    const bucketCount = 24;
    const bucketMs = 3600000;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTime = startOfDay.getTime();
    const endTime = startTime + bucketCount * bucketMs;
    const rows = queryHistoryChartRows(db, new Date(startTime).toISOString(), apiKeyFilter);
    const buckets = buildBucketsFromRows(rows, startTime, endTime, bucketCount, bucketMs, hourLabel);
    return finalizeChartBuckets(buckets);
  }

  if (period === "all") {
    const rows = queryHistoryChartRows(db, null, apiKeyFilter);
    if (rows.length === 0) return { points: [], series: [] };
    const minTs = Math.min(...rows.map((r) => new Date(r.timestamp).getTime()));
    const startOfMinDay = new Date(minTs);
    startOfMinDay.setHours(0, 0, 0, 0);
    const startTime = startOfMinDay.getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bucketMs = 86400000;
    const bucketCount = Math.max(1, Math.round((today.getTime() - startTime) / bucketMs) + 1);
    const endTime = startTime + bucketCount * bucketMs;
    const buckets = buildBucketsFromRows(rows, startTime, endTime, bucketCount, bucketMs, dayLabel, true);
    return finalizeChartBuckets(buckets);
  }

  const config = CHART_BUCKET_CONFIG[period] || CHART_BUCKET_CONFIG["7d"];
  const { bucketMs, bucketCount } = config;
  const startTime = now - bucketCount * bucketMs;
  const labelFn = bucketMs >= 86400000 ? dayLabel : hourLabel;
  const rows = queryHistoryChartRows(db, new Date(startTime).toISOString(), apiKeyFilter);
  const buckets = buildBucketsFromRows(rows, startTime, now + 1, bucketCount, bucketMs, labelFn, true);
  return finalizeChartBuckets(buckets);
}

function formatLogDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// No-op: request log is now derived from usageHistory table on read.
export async function appendRequestLog() {}

export async function getRequestLogsPage({ period = "all", page = 1, pageSize = 30 } = {}) {
  const db = await getAdapter();
  const cutoff = getPeriodCutoffIso(period);
  const where = cutoff ? "WHERE rd.timestamp >= ?" : "";
  const params = cutoff ? [cutoff] : [];
  const normalizedPageSize = Math.max(1, Math.min(100, Number(pageSize) || 30));
  const requestedPage = Math.max(1, Number(page) || 1);
  const countRow = db.get(
    `SELECT COUNT(*) AS totalItems FROM requestDetails rd ${where}`,
    params,
  );
  const totalItems = countRow?.totalItems || 0;
  const totalPages = Math.ceil(totalItems / normalizedPageSize);
  const normalizedPage = Math.min(requestedPage, Math.max(totalPages, 1));
  const offset = (normalizedPage - 1) * normalizedPageSize;

  const details = db.all(
    `SELECT rd.id AS detailId, rd.timestamp, rd.provider, rd.model, rd.connectionId,
            rd.apiKey, rd.status, rd.data, ak.name AS apiKeyName, u.username, u.email
       FROM requestDetails rd
       LEFT JOIN apiKeys ak ON ak.key = rd.apiKey
       LEFT JOIN users u ON u.id = ak.ownerUserId
       ${where}
      ORDER BY rd.timestamp DESC
      LIMIT ? OFFSET ?`,
    [...params, normalizedPageSize, offset],
  );

  const pagination = {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
    hasNext: normalizedPage < totalPages,
    hasPrev: normalizedPage > 1,
  };
  if (details.length === 0) return { logs: [], pagination };

  // Custom providers are stored under a generated id, so a readable label needs
  // the node rows. Loaded once per page, and only when there is a page to label.
  const nodeNames = {};
  try {
    const { getProviderNodes } = await import("./nodesRepo.js");
    for (const node of await getProviderNodes()) {
      if (node?.id && node?.name) nodeNames[node.id] = node.name;
    }
  } catch {}

  const times = details.map((detail) => new Date(detail.timestamp).getTime()).filter(Number.isFinite);
  const oldest = Math.min(...times) - 60_000;
  const newest = Math.max(...times) + 60_000;
  const usageRows = db.all(
    `SELECT uh.timestamp, uh.provider, uh.model, uh.connectionId, uh.apiKey,
            uh.promptTokens, uh.completionTokens, uh.cost, uh.tokens,
            ak.name AS apiKeyName, u.username, u.email
       FROM usageHistory uh
       LEFT JOIN apiKeys ak ON ak.key = uh.apiKey
       LEFT JOIN users u ON u.id = ak.ownerUserId
      WHERE uh.timestamp >= ? AND uh.timestamp <= ?
      ORDER BY uh.timestamp DESC`,
    [new Date(oldest).toISOString(), new Date(newest).toISOString()],
  );
  const usageByRequest = new Map();
  const usageByRequestWithoutKey = new Map();
  for (const row of usageRows) {
    const baseParts = [row.provider || "", row.model || "", row.connectionId || ""];
    const key = [...baseParts, row.apiKey || ""].join("\u001f");
    const looseKey = baseParts.join("\u001f");
    const bucket = usageByRequest.get(key) || [];
    const looseBucket = usageByRequestWithoutKey.get(looseKey) || [];
    bucket.push(row);
    looseBucket.push(row);
    usageByRequest.set(key, bucket);
    usageByRequestWithoutKey.set(looseKey, looseBucket);
  }

  const logs = details.map((detail) => {
    const baseParts = [
      detail.provider || "",
      detail.model || "",
      detail.connectionId || "",
    ];
    const key = [...baseParts, detail.apiKey || ""].join("\u001f");
    const detailTime = new Date(detail.timestamp).getTime();
    const candidates = detail.apiKey
      ? usageByRequest.get(key) || []
      : usageByRequestWithoutKey.get(baseParts.join("\u001f")) || [];
    let usage = null;
    let nearestDelta = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const delta = Math.abs(new Date(candidate.timestamp).getTime() - detailTime);
      if (delta < nearestDelta) {
        usage = candidate;
        nearestDelta = delta;
      }
    }
    if (nearestDelta > 60_000) usage = null;

    const parsedDetail = parseJson(detail.data, {});
    const tokens = {
      ...parseJson(usage?.tokens, {}),
      ...(parsedDetail.tokens || {}),
    };

    return {
      detailId: detail.detailId,
      timestamp: detail.timestamp,
      model: detail.model || "-",
      provider: detail.provider || "-",
      // Raw id stays on `provider`; this is what a UI should render.
      providerName: detail.provider ? providerLabel(detail.provider, nodeNames) : "-",
      username: detail.username || usage?.username || ((detail.apiKey || usage?.apiKey) ? "Unassigned key" : "Local / system"),
      email: detail.email || usage?.email || "",
      apiKeyName: detail.apiKeyName || usage?.apiKeyName || ((detail.apiKey || usage?.apiKey) ? "Unknown key" : "No API key"),
      inputTokens: getInputTokens(tokens) || usage?.promptTokens || 0,
      cachedTokens: getCachedTokens(tokens),
      cacheCreationTokens: getCacheCreationTokens(tokens),
      outputTokens: tokens?.completion_tokens || tokens?.output_tokens || usage?.completionTokens || 0,
      cost: Number.isFinite(usage?.cost) ? usage.cost : null,
      status: detail.status || "-",
      timingMs: Number.isFinite(parsedDetail.latency?.total) ? parsedDetail.latency.total : null,
      mode: parsedDetail.request?.stream === true ? "stream" : parsedDetail.request?.stream === false ? "sync" : "-",
    };
  });

  return { logs, pagination };
}

export async function getRecentLogs(limit = 200) {
  try {
    const { logs } = await getRequestLogsPage({
      period: "all",
      page: 1,
      pageSize: limit,
    });
    return logs;
  } catch (e) {
    console.error("[usageRepo] getRecentLogs failed:", e.message);
    return [];
  }
}
