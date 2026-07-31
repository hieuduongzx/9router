import { getCombos, getPublishedModels } from "@/lib/db/index.js";
import { buildPublishedModelsCatalog } from "@/lib/publishedModelsCatalog";

/**
 * Public model IDs an API client may request — exactly what Dashboard → Models
 * lists and what `/v1/models` returns: enabled (published) LLM model routes.
 * @returns {Promise<Set<string>>}
 */
export async function getPublishedModelIds() {
  const [combos, publishedModels] = await Promise.all([getCombos(), getPublishedModels()]);
  return new Set(
    buildPublishedModelsCatalog(combos, publishedModels)
      .map((model) => String(model.id || "").trim())
      .filter(Boolean),
  );
}

/**
 * Whether a client-supplied model string is routable.
 * Only public route names count — a raw `provider/model` is never published.
 * @param {string} modelStr
 */
export async function isModelPublished(modelStr) {
  const requested = String(modelStr || "").trim();
  if (!requested) return false;
  return (await getPublishedModelIds()).has(requested);
}
