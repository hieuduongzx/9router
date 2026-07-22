import { describe, expect, it } from "vitest";
import { buildProviderModelsCatalog } from "../../src/lib/providerModelsCatalog.js";

describe("provider models catalog", () => {
  it("matches checked LLM models on active provider tabs", () => {
    const models = buildProviderModelsCatalog(
      [
        { providerAlias: "ds", id: "deepseek-chat", type: "llm" },
        { providerAlias: "ds", id: "deepseek-chat", type: "llm" },
        { providerAlias: "ds", id: "deepseek-image", type: "image" },
        { providerAlias: "openai-compatible-local", id: "vendor/new-chat", type: "llm" },
        { providerAlias: "inactive-provider", id: "hidden-chat", type: "llm" },
        { providerAlias: "missing-provider", id: "orphan-chat", type: "llm" },
      ],
      [
        { provider: "deepseek", isActive: true },
        { provider: "codex", isActive: true },
        {
          provider: "openai-compatible-local",
          isActive: true,
          providerSpecificData: { prefix: "local" },
        },
        { provider: "inactive-provider", isActive: false },
      ],
      { cx: ["gpt-5.6-terra"] },
    );

    const ids = models.map((model) => model.id);
    expect(ids).toContain("ds/deepseek-chat");
    expect(ids).toContain("local/vendor/new-chat");
    expect(ids).toContain("cx/gpt-5.6-sol");
    expect(ids).not.toContain("cx/gpt-5.6-terra");
    expect(ids).not.toContain("ds/deepseek-image");
    expect(ids).not.toContain("inactive-provider/hidden-chat");
    expect(ids.filter((id) => id === "ds/deepseek-chat")).toHaveLength(1);
    expect(models.every((model) => model.object === "model")).toBe(true);
    expect(models.every((model) => model.capabilities && typeof model.capabilities === "object")).toBe(true);
  });
});
