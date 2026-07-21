import { NextResponse } from "next/server";
import { buildModelsList } from "@/app/api/v1/models/route";
import { getModelPricingCatalog, getProviderConnections } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getProviderAlias, resolveProviderId } from "@/shared/constants/providers";

export const dynamic = "force-dynamic";

function getPricingTarget(model, providerByAlias) {
  if (!model?.id || model.owned_by === "combo") return null;
  const separator = model.id.indexOf("/");
  if (separator < 1 || separator === model.id.length - 1) return null;

  const alias = model.id.slice(0, separator);
  return {
    provider: providerByAlias.get(alias) || resolveProviderId(alias),
    model: model.id.slice(separator + 1),
  };
}

export async function GET(request) {
  try {
    const activeConnections = (await getProviderConnections()).filter(
      (connection) => connection.isActive !== false,
    );
    if (activeConnections.length === 0) {
      return NextResponse.json({ models: [] });
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

    const account = await getDashboardAccount(request);
    const canEditPricing = account?.role === "admin";

    const models = await buildModelsList(["llm"]);
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
          ...(canEditPricing && target
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
