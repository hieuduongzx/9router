import { getEffectiveComboCapabilities } from "@/shared/utils/comboModelConfig";

const LLM_KIND = "llm";

export function getComboCapabilities(combo) {
  return getEffectiveComboCapabilities(combo);
}

/**
 * Pricing key for a route: its owner provider plus the public model id clients
 * send. Returns null when the route has no owner yet, since an unowned route
 * cannot be published and therefore cannot be priced.
 */
export function comboPricingTarget(combo) {
  const model = String(combo?.name || "").trim();
  const provider = String(combo?.modelProvider || "").trim();
  if (!model || !provider) return null;
  return { provider: provider.toLowerCase(), model };
}

export function buildPublishedModelsCatalog(combos, publishedModels) {
  const comboById = new Map((combos || []).map((combo) => [combo.id, combo]));
  const seenIds = new Set();
  const models = [];

  for (const published of publishedModels || []) {
    const combo = comboById.get(published.comboId);
    if (!combo || (combo.kind || LLM_KIND) !== LLM_KIND) continue;

    const id = String(combo.name || "").trim();
    const ownedBy = String(combo.modelProvider || "").trim();
    if (!id || !ownedBy || seenIds.has(id)) continue;

    seenIds.add(id);
    models.push({
      id,
      object: "model",
      owned_by: ownedBy,
      provider: ownedBy,
      comboId: combo.id,
      memberCount: Array.isArray(combo.models) ? combo.models.length : 0,
      capabilities: getComboCapabilities(combo),
      pricingTarget: comboPricingTarget(combo),
    });
  }

  return models;
}
