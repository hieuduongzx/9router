import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";

const pricingKv = makeKv("pricing");
const CACHE_TTL_MS = 5000;

let cache = { value: null, expiresAt: 0 };

function invalidate() {
  cache = { value: null, expiresAt: 0 };
}

async function getUserPricing() {
  return await pricingKv.getAll();
}

export async function getPricing() {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;

  const userPricing = await getUserPricing();
  const { PROVIDER_PRICING } = await import("open-sse/providers/pricing.js");
  const merged = {};

  for (const [provider, models] of Object.entries(PROVIDER_PRICING)) {
    merged[provider] = { ...models };
    if (userPricing[provider]) {
      for (const [model, pricing] of Object.entries(userPricing[provider])) {
        merged[provider][model] = merged[provider][model]
          ? { ...merged[provider][model], ...pricing }
          : pricing;
      }
    }
  }

  for (const [provider, models] of Object.entries(userPricing)) {
    if (!merged[provider]) {
      merged[provider] = { ...models };
    } else {
      for (const [model, pricing] of Object.entries(models)) {
        if (!merged[provider][model]) merged[provider][model] = pricing;
      }
    }
  }

  cache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

/**
 * Custom price an administrator set for a published route in Dashboard / Models.
 * That UI keys prices by `{virtualProvider, routeName}` while billing only knows
 * the upstream `{connectionId, upstreamModel}`, so the route price has to be
 * looked up from the public model name the client actually requested.
 * @param {string} publicModel model id the client asked for (a route name)
 */
export async function getRoutePricing(publicModel) {
  const routeName = String(publicModel || "").trim();
  if (!routeName || routeName.includes("/")) return null;
  const { getComboByName } = await import("./combosRepo.js");
  const combo = await getComboByName(routeName);
  const owner = String(combo?.modelProvider || "").trim();
  if (!owner) return null;
  const userPricing = await getUserPricing();
  return userPricing[owner.toLowerCase()]?.[routeName] || userPricing[owner]?.[routeName] || null;
}

/**
 * @param {string} provider upstream provider id
 * @param {string} model upstream model id
 * @param {string} [publicModel] route name the client requested, when it came through one
 */
export async function getPricingForModel(provider, model, publicModel = null) {
  if (!model) return null;
  // A route's own price wins over the upstream's — it is what the operator publishes.
  // Note the route name often equals the upstream model name (route `claude-opus-5`
  // → `a6api/claude-opus-5`), so equality must not short-circuit the lookup.
  if (publicModel) {
    const routePricing = await getRoutePricing(publicModel);
    if (routePricing) return routePricing;
  }
  const [entry] = await getModelPricingCatalog([{ provider, model }]);
  return entry?.pricing || null;
}

/**
 * Resolve many catalog prices with one custom-pricing read. Each result carries
 * the effective rate, the built-in fallback, and whether an administrator
 * override is active.
 */
export async function getModelPricingCatalog(models) {
  const entries = Array.isArray(models) ? models : [];
  if (entries.length === 0) return [];

  const userPricing = await getUserPricing();
  const { getPricingForModel: resolveDefault } = await import("open-sse/providers/pricing.js");

  return entries.map(({ provider, model }) => {
    if (!model) return { pricing: null, defaultPricing: null, source: "unpriced" };

    const defaultPricing = resolveDefault(provider, model);
    const customPricing = provider ? userPricing[provider]?.[model] : null;
    if (customPricing) {
      return {
        pricing: { ...(defaultPricing || {}), ...customPricing },
        defaultPricing,
        source: "custom",
      };
    }

    return {
      pricing: defaultPricing,
      defaultPricing,
      source: defaultPricing ? "default" : "unpriced",
    };
  });
}

// Atomic merge inside transaction (per-provider read-modify-write)
export async function updatePricing(pricingData) {
  const db = await getAdapter();
  db.transaction(() => {
    for (const [provider, models] of Object.entries(pricingData)) {
      const row = db.get(`SELECT value FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
      const current = row ? (parseJson(row.value, {}) || {}) : {};
      const merged = { ...current };
      for (const [model, pricing] of Object.entries(models)) {
        merged[model] = pricing;
      }
      db.run(
        `INSERT INTO kv(scope, key, value) VALUES('pricing', ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
        [provider, stringifyJson(merged)]
      );
    }
  });
  invalidate();
  return await getUserPricing();
}

export async function resetPricing(provider, model) {
  if (!provider) return await getUserPricing();
  const db = await getAdapter();
  db.transaction(() => {
    if (!model) {
      db.run(`DELETE FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
      return;
    }
    const row = db.get(`SELECT value FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
    const current = row ? (parseJson(row.value, {}) || {}) : {};
    delete current[model];
    if (Object.keys(current).length === 0) {
      db.run(`DELETE FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
    } else {
      db.run(
        `INSERT INTO kv(scope, key, value) VALUES('pricing', ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
        [provider, stringifyJson(current)]
      );
    }
  });
  invalidate();
  return await getUserPricing();
}

export async function resetAllPricing() {
  await pricingKv.clear();
  invalidate();
  return {};
}
