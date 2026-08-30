// Runtime detection of "did this model actually reason?" from a drained SSE body.
//
// Shared by the dashboard's per-model reasoning probe
// (src/app/api/models/test/ping.js) and the offline capability survey
// (tests/translator/real/thinking-capability-survey.real.test.js) so both judge
// the same wire signals.
//
// WHY STREAMING: the non-streaming path deletes message.reasoning_content
// whenever content is non-empty (open-sse/handlers/chatCore/nonStreamingHandler.js
// :315-320), so a non-streaming probe only ever sees reasoning text from models
// that spent their whole budget thinking. Probes must stream.

/** Forces multi-step work — a model with optional thinking should choose to use it. */
export const REASONING_PROBE_PROMPT =
  "Think step by step, then answer: a train leaves at 09:47 and arrives 3h 38m later. What time does it arrive?";

/** Thinking budget is spent before content tokens emit; a small cap yields a false negative. */
export const REASONING_PROBE_MAX_TOKENS = 512;

export const REASONING_EVIDENCE = {
  TOKENS: "reasoning_tokens",      // provider-reported usage — survives hidden CoT
  STREAM: "reasoning_content",     // a reasoning field on the delta
  INLINE: "inline_think",          // <think> smuggled into content
  ZERO: "reasoning_tokens:0",      // provider explicitly reported zero — hard negative
  NONE: "none",                    // nothing at all — soft negative
};

/**
 * Classify reasoning evidence, strongest signal first.
 *
 *   reasoning_tokens — usage.reasoning_tokens > 0. The only signal that catches
 *     models which hide their chain of thought (o-series returns no reasoning
 *     text but does bill reasoning tokens). The key is matched wherever it
 *     appears, since Gemini reports it nested under completion_tokens_details
 *     (nonStreamingHandler.js:159).
 *   reasoning_content — a reasoning field on the delta: reasoning_content /
 *     reasoning / reasoning_details, or a passed-through Claude thinking block.
 *     See open-sse/translator/concerns/reasoning.js for the vendor shapes.
 *   inline_think — <think>…</think> emitted into content by some compat layers.
 *
 * Assistant prose describing its own reasoning is deliberately NOT evidence.
 *
 * @param {string} raw drained SSE body
 * @returns {{reasoned: boolean, evidence: string, reasoningTokens: number}}
 */
export function detectReasoningEvidence(raw) {
  const text = typeof raw === "string" ? raw : "";

  let reasoningTokens = 0;
  for (const match of text.matchAll(/"reasoning_tokens"\s*:\s*(\d+)/g)) {
    reasoningTokens = Math.max(reasoningTokens, Number(match[1]) || 0);
  }
  if (reasoningTokens > 0) {
    return { reasoned: true, evidence: REASONING_EVIDENCE.TOKENS, reasoningTokens };
  }

  const streamed = /"reasoning_content"\s*:\s*"[^"]/.test(text)
    || /"reasoning"\s*:\s*"[^"]/.test(text)
    || /"reasoning_details"\s*:\s*\[\s*[{"]/.test(text)
    || /"type"\s*:\s*"thinking"/.test(text)
    || /thinking_delta/.test(text);
  if (streamed) {
    return { reasoned: true, evidence: REASONING_EVIDENCE.STREAM, reasoningTokens: 0 };
  }

  if (/<think[\s>]/i.test(text)) {
    return { reasoned: true, evidence: REASONING_EVIDENCE.INLINE, reasoningTokens: 0 };
  }

  // An explicit zero is a much harder negative than an absent field.
  const explicitZero = /"reasoning_tokens"\s*:\s*0\b/.test(text);
  return {
    reasoned: false,
    evidence: explicitZero ? REASONING_EVIDENCE.ZERO : REASONING_EVIDENCE.NONE,
    reasoningTokens: 0,
  };
}
