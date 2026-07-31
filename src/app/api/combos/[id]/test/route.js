import { NextResponse } from "next/server";
import { getComboById, getSettings } from "@/lib/localDb";
import { pingModelByKind } from "@/app/api/models/test/ping";
import { COMBO_TEST_STRATEGIES, runComboTest } from "@/lib/comboTest";

export const dynamic = "force-dynamic";

function normalizeModels(value, fallback) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) return null;
  const models = value.map((model) => String(model || "").trim()).filter(Boolean);
  if (models.length > 50 || models.some((model) => model.length > 500)) return null;
  return models;
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const combo = await getComboById(id);
    if (!combo || (combo.kind && combo.kind !== "llm")) {
      return NextResponse.json({ error: "LLM model route not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const models = normalizeModels(body.models, combo.models || []);
    if (!models) {
      return NextResponse.json({ error: "Models must be a list of at most 50 valid model IDs" }, { status: 400 });
    }
    if (models.length === 0) {
      return NextResponse.json({ error: "Add at least one model before testing" }, { status: 400 });
    }

    const settings = await getSettings();
    const savedStrategy = settings.comboStrategies?.[combo.name] || {};
    const strategy = body.strategy === undefined
      ? (savedStrategy.fallbackStrategy || settings.comboStrategy || "fallback")
      : body.strategy;
    if (!COMBO_TEST_STRATEGIES.has(strategy)) {
      return NextResponse.json({ error: "Unsupported model route strategy" }, { status: 400 });
    }

    const judgeModel = body.judgeModel === undefined
      ? (savedStrategy.judgeModel || "")
      : String(body.judgeModel || "").trim();

    const result = await runComboTest({
      comboName: combo.name,
      models,
      strategy,
      judgeModel,
      stickyLimit: settings.comboStickyRoundRobinLimit || 1,
      pingModel: (model) => pingModelByKind(model, "llm"),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to test model route" },
      { status: 500 },
    );
  }
}
