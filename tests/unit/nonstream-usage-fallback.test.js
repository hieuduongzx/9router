// Non-streaming replies from some upstreams (resellers, gateways) carry no `usage`
// block, or only a partial one. extractUsageFromResponse returned null for those, and
// the sync path — unlike the streaming path — had no estimation fallback, so the
// request recorded 0 tokens and its cost came out $0 despite a full answer.
import { describe, it, expect } from "vitest";
import { extractUsageFromResponse } from "open-sse/handlers/chatCore/requestDetail.js";

describe("extractUsageFromResponse — non-standard usage blocks", () => {
  it("reads the standard OpenAI block", () => {
    const usage = extractUsageFromResponse({ usage: { prompt_tokens: 10, completion_tokens: 4 } });
    expect(usage).toMatchObject({ prompt_tokens: 10, completion_tokens: 4 });
  });

  it("reads the Claude block", () => {
    const usage = extractUsageFromResponse({ usage: { input_tokens: 7, output_tokens: 3 } });
    expect(usage).toMatchObject({ prompt_tokens: 7, completion_tokens: 3 });
  });

  it("derives prompt tokens from total when prompt_tokens is missing", () => {
    const usage = extractUsageFromResponse({ usage: { total_tokens: 100, completion_tokens: 30 } });
    expect(usage).toMatchObject({ prompt_tokens: 70, completion_tokens: 30 });
  });

  it("keeps a completion-only usage block instead of dropping the request", () => {
    const usage = extractUsageFromResponse({ usage: { completion_tokens: 42 } });
    expect(usage).toMatchObject({ prompt_tokens: 0, completion_tokens: 42 });
  });

  it("reads Ollama-style top-level counters", () => {
    const usage = extractUsageFromResponse({ prompt_eval_count: 12, eval_count: 5 });
    expect(usage).toMatchObject({ prompt_tokens: 12, completion_tokens: 5 });
  });

  it("still returns null when there is nothing to read", () => {
    expect(extractUsageFromResponse({ choices: [{ message: { content: "hi" } }] })).toBeNull();
    expect(extractUsageFromResponse({ usage: {} })).toBeNull();
    expect(extractUsageFromResponse(null)).toBeNull();
  });
});

describe("estimation covers a reply with no usage block", () => {
  it("produces non-zero tokens from the request and answer length", async () => {
    const { estimateUsage, hasValidUsage } = await import("open-sse/utils/usageTracking.js");
    const body = { model: "gemini-3.6-flash", messages: [{ role: "user", content: "x".repeat(4000) }] };
    const estimated = estimateUsage(body, 12_000, "openai");
    expect(hasValidUsage(estimated)).toBe(true);
    expect(estimated.prompt_tokens).toBeGreaterThan(0);
    expect(estimated.completion_tokens).toBeGreaterThan(0);
  });
});
