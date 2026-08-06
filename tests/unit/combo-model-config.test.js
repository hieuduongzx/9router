import { describe, expect, it } from "vitest";
import {
  applyCapabilityOverrides,
  deriveComboCapabilities,
  getComboThinkingProfile,
  normalizeCapabilityOverrides,
  normalizeThinkingMode,
} from "@/shared/utils/comboModelConfig";
import { getComboCapabilities } from "@/lib/publishedModelsCatalog";

describe("combo model configuration", () => {
  it("normalizes persisted thinking modes and boolean capability overrides", () => {
    expect(normalizeThinkingMode()).toBe("auto");
    expect(normalizeThinkingMode("OFF")).toBe("none");
    expect(normalizeThinkingMode("not-a-level")).toBe("auto");
    expect(normalizeCapabilityOverrides({ vision: false, search: true, unknown: true, tools: "yes" }))
      .toEqual({ vision: false, search: true });
  });

  it("derives member capabilities and applies explicit on/off overrides", () => {
    const base = deriveComboCapabilities(["codex/gpt-5.6-sol"]);
    expect(base).toMatchObject({ reasoning: true, vision: true, search: true, tools: true });

    expect(applyCapabilityOverrides(base, { vision: false, audioInput: true })).toMatchObject({
      reasoning: true,
      vision: false,
      search: true,
      audioInput: true,
    });
    expect(getComboCapabilities({
      models: ["codex/gpt-5.6-sol"],
      capabilityOverrides: { reasoning: false },
    }).reasoning).toBe(false);
  });

  it("offers Auto and Off plus levels supported by route members", () => {
    const profile = getComboThinkingProfile(["codex/gpt-5.6-sol"]);
    expect(profile.options.map((option) => option.value)).toEqual(
      expect.arrayContaining(["auto", "none", "minimal", "high", "max"]),
    );
    expect(profile.reasoningModels).toBe(1);
  });
});
