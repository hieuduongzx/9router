import { describe, expect, it } from "vitest";
import { getLobeIconUrl, normalizeLobeIconKey } from "../../src/shared/utils/lobeIcons.js";

describe("Lobe provider icons", () => {
  it("accepts icon page URLs, static assets, and slugs", () => {
    expect(normalizeLobeIconKey("https://lobehub.com/icons/openai")).toBe("openai");
    expect(normalizeLobeIconKey("https://raw.githubusercontent.com/lobehub/lobe-icons/master/openai-color.png")).toBe("openai");
    expect(normalizeLobeIconKey(" Anthropic ")).toBe("anthropic");
  });

  it("builds the official static PNG path", () => {
    expect(getLobeIconUrl("openai", "dark", true)).toBe(
      "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/openai-color.png",
    );
  });
});
