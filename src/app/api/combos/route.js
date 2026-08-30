import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName, getModelProviderByName, getModelPricingCatalog } from "@/lib/localDb";
import { canEditPricing } from "@/lib/auth/pricingAccess";
import { comboPricingTarget } from "@/lib/publishedModelsCatalog";

export const dynamic = "force-dynamic";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;
const normalizeModelProvider = (value) => (
  typeof value === "string" ? value.trim() : ""
);

// GET /api/combos - Get all combos, each resolved against the pricing catalog.
// Routes are where public prices are set, so the list carries its own rates
// rather than making the dashboard cross-reference the published-model catalog.
export async function GET(request) {
  try {
    const combos = await getCombos();
    const targets = combos.map((combo) => comboPricingTarget(combo));
    const [pricingEntries, editable] = await Promise.all([
      getModelPricingCatalog(targets.map((target) => target || {})),
      canEditPricing(request),
    ]);

    return NextResponse.json({
      canEditPricing: editable,
      combos: combos.map((combo, index) => {
        const resolved = pricingEntries[index];
        return {
          ...combo,
          pricingTarget: targets[index],
          pricing: resolved?.pricing || null,
          pricingSource: resolved?.source || "unpriced",
          defaultPricing: resolved?.defaultPricing || null,
        };
      }),
    });
  } catch (error) {
    console.log("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

// POST /api/combos - Create new combo
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, models, kind, thinkingMode, capabilityOverrides, disabledMembers } = body;
    const modelProvider = normalizeModelProvider(body.modelProvider);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Validate name format
    if (!VALID_NAME_REGEX.test(name)) {
      return NextResponse.json({ error: "Name can only contain letters, numbers, -, _ and ." }, { status: 400 });
    }

    if (modelProvider.length > 80) {
      return NextResponse.json({ error: "Model provider must be 80 characters or fewer" }, { status: 400 });
    }
    if (modelProvider && !(await getModelProviderByName(modelProvider))) {
      return NextResponse.json({ error: "Model provider does not exist" }, { status: 400 });
    }

    // Check if name already exists
    const existing = await getComboByName(name);
    if (existing) {
      return NextResponse.json({ error: "Combo name already exists" }, { status: 400 });
    }

    const combo = await createCombo({
      name,
      models: Array.isArray(models) ? models : [],
      kind: kind || null,
      modelProvider: modelProvider || null,
      thinkingMode,
      capabilityOverrides,
      disabledMembers,
    });

    return NextResponse.json(combo, { status: 201 });
  } catch (error) {
    console.log("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
