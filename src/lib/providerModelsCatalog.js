import REGISTRY from "../../open-sse/providers/registry/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";

const providerById = new Map(REGISTRY.map((provider) => [provider.id, provider]));
const getProviderAlias = (providerId) => {
  const provider = providerById.get(providerId);
  return provider?.uiAlias || provider?.alias || providerId;
};
const isCompatibleProvider = (providerId) =>
  typeof providerId === "string"
  && (
    providerId.startsWith("openai-compatible-")
    || providerId.startsWith("anthropic-compatible-")
  );

export function buildProviderModelsCatalog(customModels, connections, disabledByAlias = {}) {
  const providerByStorageAlias = new Map();

  for (const connection of connections || []) {
    if (!connection?.provider || connection.isActive === false) continue;

    const provider = connection.provider;
    const registryProvider = providerById.get(provider);
    const defaultAlias = getProviderAlias(provider) || provider;
    const storageAlias = isCompatibleProvider(provider) ? provider : defaultAlias;
    const outputAlias = (
      connection?.providerSpecificData?.prefix
      || defaultAlias
      || provider
    ).trim();

    if (storageAlias && outputAlias && !providerByStorageAlias.has(storageAlias)) {
      providerByStorageAlias.set(storageAlias, {
        provider,
        outputAlias,
        storageAlias,
        builtInModels: registryProvider?.models || [],
      });
    }
  }

  const seen = new Set();
  const models = [];
  const addModel = (target, modelId) => {
    const id = `${target.outputAlias}/${modelId}`;
    if (seen.has(id)) return;
    seen.add(id);
    models.push({
      id,
      object: "model",
      owned_by: target.outputAlias,
      capabilities: getCapabilitiesForModel(target.provider, modelId),
    });
  };

  // Models explicitly added from the provider tab appear first.
  for (const customModel of customModels || []) {
    if (!customModel?.id || (customModel.kind || customModel.type || "llm") !== "llm") continue;

    const target = providerByStorageAlias.get(customModel.providerAlias);
    if (!target) continue;

    const modelId = String(customModel.id).trim();
    if (modelId) addModel(target, modelId);
  }

  // Match the provider tab's checked "Available Models": built-in LLM models
  // remain visible until the user disables them there.
  for (const target of providerByStorageAlias.values()) {
    const disabled = new Set(disabledByAlias[target.storageAlias] || []);
    for (const model of target.builtInModels) {
      const kind = model?.kind || model?.type || "llm";
      if (!model?.id || kind !== "llm" || disabled.has(model.id)) continue;
      addModel(target, model.id);
    }
  }

  return models;
}
