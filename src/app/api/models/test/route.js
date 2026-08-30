import { NextResponse } from "next/server";
import { pingModelByKind, pingModelReasoning, pingModelWebSearch } from "./ping";

// POST /api/models/test - Ping a single model via internal completions or embeddings
export async function POST(request) {
  try {
    const { model, kind, mode, thinking } = await request.json();
    if (!model) return NextResponse.json({ error: "Model required" }, { status: 400 });
    const result = mode === "web-search"
      ? await pingModelWebSearch(model)
      : mode === "reasoning"
      // `thinking` probes a specific thinking default (notably "none") instead
      // of the plain "can this model reason at all" capability check.
      ? await pingModelReasoning(model, undefined, thinking || "high")
      : await pingModelByKind(model, kind || "llm");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
