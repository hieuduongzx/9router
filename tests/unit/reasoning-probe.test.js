// Unit coverage for the runtime reasoning probe behind the dashboard's
// "Verify reasoning" button (src/app/api/models/test/ping.js) and the shared
// evidence detector it uses (src/lib/reasoningEvidence.js).
//
// No network: global.fetch is stubbed with canned SSE bodies.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  REASONING_EVIDENCE,
  THINKING_COMPLIANCE,
  detectReasoningEvidence,
  judgeThinkingCompliance,
} from "@/lib/reasoningEvidence.js";
import { pingModelReasoning } from "@/app/api/models/test/ping.js";

const E = REASONING_EVIDENCE;
const C = THINKING_COMPLIANCE;

describe("detectReasoningEvidence", () => {
  it.each([
    ["usage reasoning_tokens", '{"usage":{"reasoning_tokens":128}}', true, E.TOKENS],
    // Gemini reports it nested under completion_tokens_details.
    ["nested reasoning_tokens", '{"usage":{"completion_tokens_details":{"reasoning_tokens":64}}}', true, E.TOKENS],
    ["reasoning_content", 'data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}', true, E.STREAM],
    ["reasoning string", 'data: {"choices":[{"delta":{"reasoning":"hmm"}}]}', true, E.STREAM],
    ["reasoning_details", 'data: {"choices":[{"delta":{"reasoning_details":[{"text":"x"}]}}]}', true, E.STREAM],
    ["claude thinking block", 'data: {"content_block":{"type":"thinking"}}', true, E.STREAM],
    ["claude thinking_delta", 'data: {"delta":{"type":"thinking_delta"}}', true, E.STREAM],
    ["inline <think>", 'data: {"choices":[{"delta":{"content":"<think>hm</think>"}}]}', true, E.INLINE],
  ])("treats %s as evidence", (_label, raw, reasoned, evidence) => {
    expect(detectReasoningEvidence(raw)).toMatchObject({ reasoned, evidence });
  });

  it("reports an explicit zero as a hard negative", () => {
    expect(detectReasoningEvidence('{"usage":{"reasoning_tokens":0}}'))
      .toMatchObject({ reasoned: false, evidence: E.ZERO });
  });

  it.each([
    ["plain content", 'data: {"choices":[{"delta":{"content":"13:25"}}]}'],
    // Prose about reasoning is not reasoning — the model can always claim it thought.
    ["prose claiming to think", 'data: {"choices":[{"delta":{"content":"Let me think step by step"}}]}'],
    ["empty reasoning field", 'data: {"choices":[{"delta":{"reasoning_content":""}}]}'],
    ["empty body", ""],
  ])("does not count %s", (_label, raw) => {
    expect(detectReasoningEvidence(raw)).toMatchObject({ reasoned: false, evidence: E.NONE });
  });

  it("prefers the token signal over streamed text", () => {
    const raw = 'data: {"delta":{"reasoning_content":"a"}}\ndata: {"usage":{"reasoning_tokens":9}}';
    expect(detectReasoningEvidence(raw)).toMatchObject({ evidence: E.TOKENS, reasoningTokens: 9 });
  });

  it("survives a non-string body", () => {
    expect(detectReasoningEvidence(undefined)).toMatchObject({ reasoned: false, evidence: E.NONE });
  });
});

describe("pingModelReasoning", () => {
  const stubFetch = (impl) => {
    global.fetch = vi.fn(impl);
  };
  const sseResponse = (body) => ({ ok: true, status: 200, text: async () => body });
  const errorResponse = (status, body) => ({ ok: false, status, text: async () => body });

  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

  it("verifies a model that reports reasoning tokens", async () => {
    stubFetch(async () => sseResponse('data: {"usage":{"reasoning_tokens":77}}\ndata: [DONE]'));
    const result = await pingModelReasoning("glm/glm-5", "http://127.0.0.1:1");
    expect(result).toMatchObject({
      ok: true,
      supported: true,
      verdict: "verified",
      evidence: REASONING_EVIDENCE.TOKENS,
      reasoningTokens: 77,
    });
  });

  it("streams the probe — the non-streaming path strips reasoning_content", async () => {
    stubFetch(async () => sseResponse('data: {"choices":[{"delta":{"reasoning_content":"x"}}]}'));
    await pingModelReasoning("glm/glm-5", "http://127.0.0.1:1");
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBe("high");
  });

  // The probe must reproduce what the router sends for a route's thinking
  // default, per applyModelThinkingDefault() — not a hardcoded reasoning_effort.
  it.each([
    ["none", { reasoning_effort: "none" }],
    ["low", { reasoning_effort: "low" }],
    ["thinking", { thinking: { type: "enabled" } }],
  ])("stamps the %s thinking default onto the body", async (mode, expected) => {
    stubFetch(async () => sseResponse("data: {}"));
    await pingModelReasoning("glm/glm-5", "http://127.0.0.1:1", mode);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject(expected);
  });

  it("sends no thinking intent at all for auto", async () => {
    stubFetch(async () => sseResponse("data: {}"));
    await pingModelReasoning("glm/glm-5", "http://127.0.0.1:1", "auto");
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.thinking).toBeUndefined();
  });

  it("calls reasoning_tokens=0 unsupported, not merely unproven", async () => {
    stubFetch(async () => sseResponse('data: {"usage":{"reasoning_tokens":0}}'));
    expect(await pingModelReasoning("openai/gpt-4o", "http://127.0.0.1:1"))
      .toMatchObject({ ok: false, supported: false, verdict: "unsupported" });
  });

  it("stays unknown when there is simply no evidence (the model may hide its CoT)", async () => {
    stubFetch(async () => sseResponse('data: {"choices":[{"delta":{"content":"13:25"}}]}'));
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ ok: false, supported: null, verdict: "unknown" });
  });

  it("treats a 4xx naming the reasoning parameter as unsupported", async () => {
    stubFetch(async () => errorResponse(400, JSON.stringify({
      error: { message: "Unrecognized request argument: reasoning_effort" },
    })));
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ supported: false, verdict: "unsupported" });
  });

  it("does not blame the model for a credential failure", async () => {
    stubFetch(async () => errorResponse(401, JSON.stringify({ error: { message: "invalid api key" } })));
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ supported: null, verdict: "unknown" });
  });

  it("reports a 5xx as an error rather than a capability verdict", async () => {
    stubFetch(async () => errorResponse(500, "upstream exploded"));
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ supported: null, verdict: "error" });
  });

  it("reports an empty stream as unknown", async () => {
    stubFetch(async () => sseResponse(""));
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ verdict: "unknown", error: "Provider returned an empty stream" });
  });

  it("does not throw when the request itself fails", async () => {
    stubFetch(async () => { throw new Error("connect ECONNREFUSED"); });
    expect(await pingModelReasoning("x/y", "http://127.0.0.1:1"))
      .toMatchObject({ ok: false, verdict: "error", error: "connect ECONNREFUSED" });
  });
});

describe("judgeThinkingCompliance", () => {
  const reasoned = { verdict: "verified", reasoned: true, evidence: E.TOKENS, reasoningTokens: 42 };
  const reportedZero = { verdict: "unsupported", reasoned: false, evidence: E.ZERO, reasoningTokens: 0 };
  const silent = { verdict: "unknown", reasoned: false, evidence: E.NONE, reasoningTokens: 0 };

  // The whole point of the combo-editor button: an operator turns thinking off
  // and the model keeps reasoning (and keeps billing) anyway.
  it("flags a model that still reasons when thinking is off", () => {
    expect(judgeThinkingCompliance("none", reasoned)).toMatchObject({ state: C.VIOLATION });
  });

  it("accepts thinking off when the provider reports zero reasoning tokens", () => {
    expect(judgeThinkingCompliance("none", reportedZero)).toMatchObject({ state: C.OK });
  });

  it("will not claim thinking is off on silence alone", () => {
    expect(judgeThinkingCompliance("none", silent)).toMatchObject({ state: C.UNPROVEN });
  });

  it("treats off/disabled as the same mode as none", () => {
    expect(judgeThinkingCompliance("off", reasoned)).toMatchObject({ state: C.VIOLATION });
    expect(judgeThinkingCompliance("disabled", reasoned)).toMatchObject({ state: C.VIOLATION });
  });

  it("flags a model asked to think that reports zero reasoning tokens", () => {
    expect(judgeThinkingCompliance("high", reportedZero)).toMatchObject({ state: C.VIOLATION });
  });

  it("accepts a model that reasons when asked to", () => {
    expect(judgeThinkingCompliance("high", reasoned)).toMatchObject({ state: C.OK });
  });

  it("never reports a violation for auto — no default is imposed", () => {
    expect(judgeThinkingCompliance("auto", reasoned)).toMatchObject({ state: C.OK });
    expect(judgeThinkingCompliance("auto", reportedZero)).toMatchObject({ state: C.OK });
    expect(judgeThinkingCompliance("auto", silent)).toMatchObject({ state: C.OK });
  });

  it("reports a failed probe as an error, not a violation", () => {
    expect(judgeThinkingCompliance("none", { verdict: "error", error: "HTTP 500" }))
      .toMatchObject({ state: C.ERROR, label: "HTTP 500" });
    expect(judgeThinkingCompliance("none", null)).toMatchObject({ state: C.ERROR });
  });

  it("falls back to the verdict when `reasoned` is absent", () => {
    expect(judgeThinkingCompliance("none", { verdict: "verified" })).toMatchObject({ state: C.VIOLATION });
  });

  // judgeThinkingCompliance uses the app-side normalizer to keep the provider
  // registry out of the combos client bundle; the router uses the open-sse one.
  // They must agree, or the button would judge a different mode than runs.
  it("normalizes modes identically to the router", async () => {
    const { normalizeThinkingMode } = await import("@/shared/utils/comboModelConfig.js");
    const { normalizeModelThinkingDefault } = await import(
      "open-sse/translator/concerns/modelThinkingDefault.js"
    );
    const inputs = [
      "auto", "none", "off", "disabled", "thinking", "minimal", "low", "medium",
      "high", "xhigh", "max", "HIGH", " none ", "bogus", "", null, undefined,
    ];
    for (const input of inputs) {
      expect(normalizeThinkingMode(input), `mode ${JSON.stringify(input)}`)
        .toBe(normalizeModelThinkingDefault(input));
    }
  });
});
