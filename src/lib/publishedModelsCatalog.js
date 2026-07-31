import { resolveProviderId } from "@/shared/constants/providers";
import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";

const LLM_KIND = "llm";

function memberValue(member) {
  if (typeof member === "string") return member;
  if (member && typeof member === "object") return member.value || member.id || "";
  return "";
}

function mergeCapabilities(target, capabilities) {
  for (const [key, value] of Object.entries(capabilities || {})) {
    if (typeof value === "boolean") {
      target[key] = Boolean(target[key]) || value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      target[key] = Math.max(Number(target[key]) || 0, value);
    } else if (Array.isArray(value)) {
      target[key] = Array.from(new Set([...(target[key] || []), ...value]));
    } else if (value != null && target[key] == null) {
      target[key] = value;
    }
  }
}

export function getComboCapabilities(combo) {
  const capabilities = {};
  for (const member of combo?.models || []) {
    const value = memberValue(member).trim();
    if (!value) continue;
    const separator = value.indexOf("/");
    const providerAlias = separator > 0 ? value.slice(0, separator) : "";
    const modelId = separator > 0 ? value.slice(separator + 1) : value;
    const providerId = resolveProviderId(providerAlias) || providerAlias;
    mergeCapabilities(capabilities, getCapabilitiesForModel(providerId, modelId));
  }
  return capabilities;
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
      pricingTarget: { provider: ownedBy.toLowerCase(), model: id },
    });
  }

  return models;
}
