import { describe, expect, it } from "vitest";
import {
  applyModelThinkingDefault,
  normalizeModelThinkingDefault,
} from "../../open-sse/translator/concerns/modelThinkingDefault.js";

describe("published model thinking defaults", () => {
  it("defaults to Auto and normalizes Off to none", () => {
    expect(normalizeModelThinkingDefault()).toBe("auto");
    expect(normalizeModelThinkingDefault("off")).toBe("none");
    expect(normalizeModelThinkingDefault("invalid")).toBe("auto");
  });

  it("adds the route default when the client omitted thinking intent", () => {
    expect(applyModelThinkingDefault({ model: "route" }, "none")).toEqual({
      model: "route",
      reasoning_effort: "none",
    });
    expect(applyModelThinkingDefault({ model: "route" }, "thinking")).toEqual({
      model: "route",
      thinking: { type: "enabled" },
    });
  });

  it("never overwrites explicit client intent in any supported shape", () => {
    const openAI = { reasoning_effort: "high" };
    const claude = { thinking: { type: "disabled" } };
    const gemini = { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } };

    expect(applyModelThinkingDefault(openAI, "none")).toBe(openAI);
    expect(applyModelThinkingDefault(claude, "high")).toBe(claude);
    expect(applyModelThinkingDefault(gemini, "max")).toBe(gemini);
  });
});
