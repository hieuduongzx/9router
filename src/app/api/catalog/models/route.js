import { NextResponse } from "next/server";
import { getCombos, getModelPricingCatalog, getModelProviders, getPublishedModels } from "@/lib/localDb";
import { canEditPricing as resolveCanEditPricing } from "@/lib/auth/pricingAccess";
import { buildPublishedModelsCatalog } from "@/lib/publishedModelsCatalog";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const [combos, publishedModels, modelProviders] = await Promise.all([
      getCombos(),
      getPublishedModels(),
      getModelProviders(),
    ]);
    const models = buildPublishedModelsCatalog(combos, publishedModels);
    const providerIconByName = new Map(
      modelProviders.map((provider) => [provider.name.toLowerCase(), provider.iconKey]),
    );

    const canEditPricing = await resolveCanEditPricing(request);

    const pricingEntries = await getModelPricingCatalog(
      models.map((model) => model.pricingTarget),
    );

    return NextResponse.json({
      canEditPricing,
      mode: "published",
      models: models.map((model, index) => {
        const resolved = pricingEntries[index];
        return {
          id: model.id,
          provider: model.provider,
          providerIcon: providerIconByName.get(model.provider.toLowerCase()) || "",
          comboId: model.comboId,
          memberCount: model.memberCount,
          capabilities: model.capabilities,
          pricingTarget: model.pricingTarget,
          pricing: resolved?.pricing || null,
          pricingSource: resolved?.source || "unpriced",
          defaultPricing: resolved?.defaultPricing || null,
        };
      }),
    });
  } catch (error) {
    console.error("[API] Failed to build published model catalog:", error);
    return NextResponse.json({ error: "Failed to load published models" }, { status: 500 });
  }
}
