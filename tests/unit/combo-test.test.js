import { describe, expect, it, vi } from "vitest";
import { runComboTest } from "../../src/lib/comboTest.js";

describe("model route strategy tests", () => {
  it("fallback stops after the first working model and marks the rest skipped", async () => {
    const pingModel = vi.fn(async (model) => model === "working/model"
      ? { ok: true, status: 200, latencyMs: 12 }
      : { ok: false, status: 503, latencyMs: 7, error: "offline" });

    const result = await runComboTest({
      comboName: "fallback-route",
      models: ["failed/model", "working/model", "unused/model"],
      strategy: "fallback",
      pingModel,
    });

    expect(result.ok).toBe(true);
    expect(result.results.map(({ model, state, attemptOrder }) => ({ model, state, attemptOrder }))).toEqual([
      { model: "failed/model", state: "failed", attemptOrder: 1 },
      { model: "working/model", state: "success", attemptOrder: 2 },
      { model: "unused/model", state: "skipped", attemptOrder: null },
    ]);
    expect(pingModel).toHaveBeenCalledTimes(2);
  });

  it("round robin rotates the first attempted model without changing live route rotation", async () => {
    const pingModel = vi.fn(async () => ({ ok: true, status: 200, latencyMs: 5 }));
    const options = {
      comboName: "round-robin-route",
      models: ["first/model", "second/model"],
      strategy: "round-robin",
      stickyLimit: 1,
      pingModel,
    };

    await runComboTest(options);
    await runComboTest(options);

    expect(pingModel.mock.calls.map(([model]) => model)).toEqual(["first/model", "second/model"]);
  });

  it("fusion tests every panel model in parallel and then tests the selected judge", async () => {
    const started = [];
    const pingModel = vi.fn(async (model) => {
      started.push(model);
      await new Promise((resolve) => setTimeout(resolve, model === "judge/model" ? 1 : 5));
      return model === "failed/model"
        ? { ok: false, status: 502, latencyMs: 5, error: "bad gateway" }
        : { ok: true, status: 200, latencyMs: 5 };
    });

    const result = await runComboTest({
      comboName: "fusion-route",
      models: ["first/model", "second/model", "failed/model"],
      strategy: "fusion",
      judgeModel: "judge/model",
      pingModel,
    });

    expect(started.slice(0, 3)).toEqual(["first/model", "second/model", "failed/model"]);
    expect(started[3]).toBe("judge/model");
    expect(result.results.map((entry) => entry.state)).toEqual(["success", "success", "failed"]);
    expect(result.judge).toMatchObject({ model: "judge/model", state: "success", role: "judge" });
    expect(result.ok).toBe(true);
  });
});
