import { NextResponse } from "next/server";
import { buildProviderModelsCatalog } from "@/lib/providerModelsCatalog";
import { getCustomModels, getModelPricingCatalog, getProviderConnections } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { getProviderAlias, resolveProviderId } from "@/shared/constants/providers";
import {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_COOKIE,
  resolveDashboardViewMode,
} from "@/shared/constants/dashboardView";

export const dynamic = "force-dynamic";

function getPricingTarget(model, providerByAlias) {
  if (!model?.id || model.owned_by === "combo") return null;
  const separator = model.id.indexOf("/");
  if (separator < 1 || separator === model.id.length - 1) return null;

  const alias = model.id.slice(0, separator);
  const provider = providerByAlias.get(alias) || resolveProviderId(alias) || alias;
  return {
    provider,
    // Keep nested vendor path (openrouter/google/lyria-...) intact after the first slash.
    model: model.id.slice(separator + 1),
  };
}

export async function GET(request) {
  try {
    const activeConnections = (await getProviderConnections()).filter(
      (connection) => connection.isActive !== false,
    );
    if (activeConnections.length === 0) {
      return NextResponse.json({ models: [], canEditPricing: false });
    }

    const providerByAlias = new Map();
    for (const connection of activeConnections) {
      const provider = connection.provider;
      const alias = (
        connection?.providerSpecificData?.prefix
        || getProviderAlias(provider)
        || provider
      ).trim();
      if (!providerByAlias.has(alias)) providerByAlias.set(alias, provider);
    }

    // Pricing edit controls only for signed-in admins. Guests still get the public catalog.
    let canEditPricing = false;
    try {
      const account = await getDashboardAccount(request);
      const viewMode = resolveDashboardViewMode(
        account?.role,
        request.cookies?.get(DASHBOARD_VIEW_COOKIE)?.value,
      );
      canEditPricing = account?.role === "admin" && viewMode === DASHBOARD_VIEW_ADMIN;
    } catch {
      canEditPricing = false;
    }

    // Mirror the checked "Available Models" shown on provider tabs:
    // manually added models plus built-in LLM models that were not disabled.
    const [customModels, disabledByAlias] = await Promise.all([
      getCustomModels(),
      getDisabledModels(),
    ]);
    const models = buildProviderModelsCatalog(
      customModels,
      activeConnections,
      disabledByAlias,
    );
    const pricingTargets = models.map((model) => getPricingTarget(model, providerByAlias));
    const pricingEntries = await getModelPricingCatalog(
      pricingTargets.map((target) => target || {}),
    );

    return NextResponse.json({
      canEditPricing,
      models: models.map((model, index) => {
        const target = pricingTargets[index];
        const resolved = pricingEntries[index];
        return {
          id: model.id,
          provider: model.owned_by || model.id.split("/")[0] || "other",
          capabilities: model.capabilities || {},
          pricing: resolved?.pricing || null,
          pricingSource: resolved?.source || "unpriced",
          // Always expose target so admins can price previously unpriced models.
          // UI only enables editors when canEditPricing is true.
          ...(target
            ? {
                pricingTarget: target,
                defaultPricing: resolved?.defaultPricing || null,
              }
            : {}),
        };
      }),
    });
  } catch (error) {
    console.error("[API] Failed to build account model catalog:", error);
    return NextResponse.json({ error: "Failed to load available models" }, { status: 500 });
  }
}
