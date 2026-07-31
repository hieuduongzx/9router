import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName, getModelProviderByName } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;
const normalizeModelProvider = (value) => (
  typeof value === "string" ? value.trim() : ""
);

// GET /api/combos - Get all combos
export async function GET() {
  try {
    const combos = await getCombos();
    return NextResponse.json({ combos });
  } catch (error) {
    console.log("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

// POST /api/combos - Create new combo
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, models, kind } = body;
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
    });

    return NextResponse.json(combo, { status: 201 });
  } catch (error) {
    console.log("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
