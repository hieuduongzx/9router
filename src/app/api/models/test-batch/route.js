import { NextResponse } from "next/server";
import { testModel } from "../testModel";

const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

// POST /api/models/test-batch - Test multiple models with bounded concurrency.
export async function POST(request) {
  try {
    const body = await request.json();
    const models = Array.isArray(body.models) ? body.models.filter(Boolean) : [];
    const concurrency = Math.min(
      Math.max(Number(body.concurrency) || DEFAULT_CONCURRENCY, 1),
      MAX_CONCURRENCY
    );

    if (models.length === 0) {
      return NextResponse.json({ error: "models is required" }, { status: 400 });
    }

    const results = await runWithConcurrency(models, concurrency, async (item) => {
      const model = typeof item === "string" ? item : item.model;
      const kind = typeof item === "string" ? body.kind : item.kind || body.kind;
      const id = typeof item === "string" ? item : item.id || model;
      const result = await testModel({ model, kind, request });
      return { id, model, kind: kind || null, ...result };
    });

    return NextResponse.json({
      ok: results.every((result) => result.ok),
      results,
      summary: {
        total: results.length,
        passed: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
