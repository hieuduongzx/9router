import { describe, expect, it } from "vitest";
import { formatRequestReasoning } from "../../src/shared/utils/requestReasoning.js";

describe("request reasoning display", () => {
  it.each([
    [null, "—"],
    [{ mode: "none" }, "Off"],
    [{ mode: "auto" }, "Auto"],
    [{ mode: "enabled" }, "On"],
    [{ mode: "adaptive" }, "Adaptive"],
    [{ mode: "level", level: "xhigh" }, "xhigh"],
    [{ mode: "budget", budget: 8192 }, `${(8192).toLocaleString()} tokens`],
  ])("formats %j as %s", (intent, label) => {
    expect(formatRequestReasoning(intent)).toBe(label);
  });
});
