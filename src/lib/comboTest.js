import { getRotatedModels } from "../../open-sse/services/combo.js";

export const COMBO_TEST_STRATEGIES = new Set(["fallback", "round-robin", "fusion"]);

function skippedResult(model, index) {
  return {
    model,
    index,
    state: "skipped",
    ok: null,
    status: null,
    latencyMs: null,
    error: null,
    attemptOrder: null,
  };
}

async function probeModel(entry, attemptOrder, pingModel) {
  try {
    const result = await pingModel(entry.model);
    return {
      model: entry.model,
      index: entry.index,
      state: result?.ok ? "success" : "failed",
      ok: result?.ok === true,
      status: result?.status ?? null,
      latencyMs: Number.isFinite(result?.latencyMs) ? result.latencyMs : null,
      error: result?.ok ? null : (result?.error || "Model test failed"),
      attemptOrder,
    };
  } catch (error) {
    return {
      model: entry.model,
      index: entry.index,
      state: "failed",
      ok: false,
      status: null,
      latencyMs: null,
      error: error?.message || String(error),
      attemptOrder,
    };
  }
}

function summarize(results) {
  return results.reduce(
    (summary, result) => {
      summary[result.state] += 1;
      return summary;
    },
    { success: 0, failed: 0, skipped: 0 },
  );
}

export async function runComboTest({
  comboName,
  models,
  strategy = "fallback",
  judgeModel = "",
  stickyLimit = 1,
  pingModel,
}) {
  if (typeof pingModel !== "function") throw new Error("pingModel is required");

  const entries = (Array.isArray(models) ? models : [])
    .map((model, index) => ({ model: String(model || "").trim(), index }))
    .filter((entry) => entry.model);
  if (entries.length === 0) throw new Error("Add at least one model before testing");

  const selectedStrategy = COMBO_TEST_STRATEGIES.has(strategy) ? strategy : "fallback";
  const startedAt = Date.now();
  let results = entries.map((entry) => skippedResult(entry.model, entry.index));
  let judge = null;

  if (selectedStrategy === "fusion") {
    const tested = await Promise.all(
      entries.map((entry, index) => probeModel(entry, index + 1, pingModel)),
    );
    for (const result of tested) results[result.index] = result;

    const successfulPanels = tested.filter((result) => result.ok);
    if (successfulPanels.length >= 2) {
      const selectedJudge = String(judgeModel || entries[0].model).trim() || entries[0].model;
      judge = await probeModel(
        { model: selectedJudge, index: -1 },
        tested.length + 1,
        pingModel,
      );
      judge.role = "judge";
    }

    const ok = successfulPanels.length === 1 || (successfulPanels.length >= 2 && judge?.ok === true);
    return {
      ok,
      strategy: selectedStrategy,
      durationMs: Date.now() - startedAt,
      results,
      judge,
      summary: summarize(results),
      message: successfulPanels.length === 0
        ? "All Fusion panel models failed"
        : successfulPanels.length === 1
          ? "One panel model succeeded; Fusion will use its direct response"
          : judge?.ok
            ? "Fusion panel and judge succeeded"
            : "Fusion panel succeeded but the judge failed",
    };
  }

  const orderedEntries = selectedStrategy === "round-robin"
    ? getRotatedModels(entries, `__test__:${comboName || "combo"}`, "round-robin", stickyLimit)
    : entries;

  for (let index = 0; index < orderedEntries.length; index += 1) {
    const result = await probeModel(orderedEntries[index], index + 1, pingModel);
    results[result.index] = result;
    if (result.ok) break;
  }

  const ok = results.some((result) => result.ok);
  return {
    ok,
    strategy: selectedStrategy,
    durationMs: Date.now() - startedAt,
    results,
    judge,
    summary: summarize(results),
    message: ok ? "Route found a working model" : "All attempted route models failed",
  };
}
