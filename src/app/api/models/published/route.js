import { NextResponse } from "next/server";
import {
  addPublishedModel,
  deletePublishedModel,
  getComboById,
  getPublishedModels,
} from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ models: await getPublishedModels() });
  } catch (error) {
    console.error("[API] Failed to load published models:", error);
    return NextResponse.json({ error: "Failed to load published models" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { comboId } = await request.json();
    if (!comboId) {
      return NextResponse.json({ error: "Combo is required" }, { status: 400 });
    }

    const combo = await getComboById(comboId);
    if (!combo || (combo.kind && combo.kind !== "llm")) {
      return NextResponse.json({ error: "LLM combo not found" }, { status: 404 });
    }
    if (!String(combo.modelProvider || "").trim()) {
      return NextResponse.json(
        { error: "Set the combo's model provider before publishing it" },
        { status: 400 },
      );
    }
    if (!Array.isArray(combo.models) || combo.models.length === 0) {
      return NextResponse.json(
        { error: "Add at least one routed model to the combo before publishing it" },
        { status: 400 },
      );
    }

    const added = await addPublishedModel(comboId);
    if (!added) {
      return NextResponse.json({ error: "Model is already published" }, { status: 409 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to publish model:", error);
    return NextResponse.json({ error: "Failed to publish model" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const comboId = new URL(request.url).searchParams.get("comboId");
    if (!comboId) {
      return NextResponse.json({ error: "Combo is required" }, { status: 400 });
    }
    await deletePublishedModel(comboId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to unpublish model:", error);
    return NextResponse.json({ error: "Failed to unpublish model" }, { status: 500 });
  }
}
