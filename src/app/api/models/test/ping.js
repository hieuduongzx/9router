import { getApiKeys } from "@/lib/localDb";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { applyModelThinkingDefault } from "open-sse/translator/concerns/modelThinkingDefault.js";
import {
  REASONING_EVIDENCE,
  REASONING_PROBE_MAX_TOKENS,
  REASONING_PROBE_PROMPT,
  detectReasoningEvidence,
} from "@/lib/reasoningEvidence";

const CLI_TOKEN_SALT = "9r-cli-auth";

function createSilentWavFile() {
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;
  const durationMs = 250;
  const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: "audio/wav" });
}

async function getInternalHeaders() {
  let apiKey = null;
  try {
    const keys = await getApiKeys();
    apiKey = keys.find((k) => k.isActive !== false)?.key || null;
  } catch {}

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  headers["x-9r-cli-token"] = await getConsistentMachineId(CLI_TOKEN_SALT);
  return headers;
}

const VERIFIED_SEARCH_EVIDENCE = new Set([
  "web_search_call",
  "server_tool_use",
  "grounding_metadata",
  "builtin_web_search_results",
  "web_search_results",
  "citations",
]);

function getResponseError(parsed, rawText, status) {
  const detail = parsed?.error?.message
    || parsed?.msg
    || parsed?.message
    || parsed?.error
    || rawText;
  return `HTTP ${status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`;
}

function splitRoutedModel(model) {
  const separator = typeof model === "string" ? model.indexOf("/") : -1;
  if (separator <= 0 || separator === model.length - 1) return null;
  return {
    provider: model.slice(0, separator),
    model: model.slice(separator + 1),
  };
}

/**
 * Execute the provider's hosted search tool and require provider-native,
 * structured evidence. Assistant text, markdown links and bare URLs never count.
 */
export async function pingModelWebSearch(
  model,
  baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`,
) {
  const routed = splitRoutedModel(model);
  if (!routed) {
    return {
      ok: false,
      supported: null,
      verdict: "unknown",
      error: "A provider/model route is required to verify native web search",
    };
  }

  const headers = await getInternalHeaders();
  const start = Date.now();

  const res = await fetch(`${baseUrl}/api/v1/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: routed.provider,
      search_model: routed.model,
      query: "Search the live public web now for today's official AI product release news and cite the sources you actually retrieved.",
      max_results: 3,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const latencyMs = Date.now() - start;
  const rawText = await res.text().catch(() => "");
  let parsed = null;
  try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

  if (!res.ok) {
    const detail = parsed?.error?.message || parsed?.error || parsed?.message || rawText;
    const detailText = String(detail || "").slice(0, 240);
    const noVerifier = /unsupported chat-search provider|does not support web search|unknown provider/i.test(detailText);
    const explicitUnsupported = !noVerifier
      && res.status >= 400
      && res.status < 500
      && /(?:unsupported|not supported|unknown|invalid).*(?:web.?search|tool)|(?:web.?search|tool).*(?:unsupported|not supported|unknown|invalid)/i.test(detailText);
    return {
      ok: false,
      supported: explicitUnsupported ? false : null,
      verdict: explicitUnsupported ? "unsupported" : noVerifier ? "unknown" : "error",
      latencyMs,
      status: res.status,
      error: getResponseError(parsed, rawText, res.status),
    };
  }

  if (parsed?.error) {
    const providerError = parsed.error?.message || parsed.error || "Provider returned an error";
    return {
      ok: false,
      supported: null,
      verdict: "error",
      latencyMs,
      status: res.status,
      error: String(providerError).slice(0, 240),
    };
  }

  const evidence = parsed?.metrics?.search_evidence;
  const evidenceType = typeof evidence?.type === "string" ? evidence.type : null;
  const verified = evidence?.verified === true && VERIFIED_SEARCH_EVIDENCE.has(evidenceType);
  if (!verified) {
    return {
      ok: false,
      supported: null,
      verdict: "unknown",
      latencyMs,
      status: res.status,
      error: "No provider-native search evidence was returned; assistant text was ignored",
    };
  }

  return {
    ok: true,
    supported: true,
    verdict: "verified",
    latencyMs,
    status: res.status,
    evidenceType,
    searchCallCount: Number(evidence.search_call_count) || 0,
    resultCount: Number(evidence.result_count) || 0,
    error: null,
  };
}

/**
 * Ask the model to reason and require wire-level evidence that it did.
 *
 * Streams, because the non-streaming path strips reasoning_content whenever
 * content is non-empty — see the note in src/lib/reasoningEvidence.js.
 *
 * `thinking` is a model-route thinking default (auto | none | thinking | level).
 * It is stamped onto the body with the same applyModelThinkingDefault() the
 * router uses, so probing "none" reproduces exactly what an operator who turned
 * thinking off would send — rather than the client-wins path a hardcoded
 * reasoning_effort would take.
 *
 * The catalog's `reasoning` flag is documentation-based; this is runtime proof.
 */
export async function pingModelReasoning(
  model,
  baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`,
  thinking = "high",
) {
  const headers = await getInternalHeaders();
  const start = Date.now();

  const body = applyModelThinkingDefault({
    model,
    stream: true,
    // Not honoured by every upstream, but where it is we get the strongest signal.
    stream_options: { include_usage: true },
    max_tokens: REASONING_PROBE_MAX_TOKENS,
    messages: [{ role: "user", content: REASONING_PROBE_PROMPT }],
  }, thinking);

  let res;
  try {
    res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // High effort reasoning is slow — well above the 15s plain-chat probe.
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    return {
      ok: false,
      supported: null,
      verdict: "error",
      latencyMs: Date.now() - start,
      error: error?.name === "TimeoutError" ? "Timed out after 60s" : (error?.message || "Network error"),
    };
  }

  const latencyMs = Date.now() - start;
  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    let parsed = null;
    try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}
    const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || rawText;
    const detailText = String(detail || "").slice(0, 240);
    // Credential / quota problems say nothing about reasoning support.
    const credIssue = [401, 402, 403, 429].includes(res.status);
    // The upstream naming the reasoning parameter in a 4xx is a real negative.
    const explicitUnsupported = !credIssue
      && res.status >= 400
      && res.status < 500
      && /(?:unsupported|not supported|unknown|invalid|unrecognized|does not support).*(?:reasoning|thinking|effort)|(?:reasoning|thinking|effort).*(?:unsupported|not supported|unknown|invalid|unrecognized|is not allowed)/i.test(detailText);
    return {
      ok: false,
      supported: explicitUnsupported ? false : null,
      verdict: explicitUnsupported ? "unsupported" : credIssue ? "unknown" : "error",
      latencyMs,
      status: res.status,
      error: getResponseError(parsed, rawText, res.status),
    };
  }

  if (!rawText) {
    return {
      ok: false,
      supported: null,
      verdict: "unknown",
      latencyMs,
      status: res.status,
      error: "Provider returned an empty stream",
    };
  }

  const { reasoned, evidence, reasoningTokens } = detectReasoningEvidence(rawText);
  if (reasoned) {
    return {
      ok: true,
      supported: true,
      verdict: "verified",
      latencyMs,
      status: res.status,
      reasoned: true,
      evidence,
      reasoningTokens,
      error: null,
    };
  }

  // reasoning_tokens:0 is the provider stating it did not reason. Anything else
  // only means we saw no evidence — a model may hide its CoT and report no usage.
  const hardNegative = evidence === REASONING_EVIDENCE.ZERO;
  return {
    ok: false,
    supported: hardNegative ? false : null,
    verdict: hardNegative ? "unsupported" : "unknown",
    latencyMs,
    status: res.status,
    reasoned: false,
    evidence,
    reasoningTokens: 0,
    error: hardNegative
      ? "Provider reported reasoning_tokens=0"
      : "No reasoning evidence was returned; assistant text was ignored",
  };
}

export async function pingModelByKind(model, kind, baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`) {
  const headers = await getInternalHeaders();
  const start = Date.now();

  if (kind === "embedding") {
    const res = await fetch(`${baseUrl}/api/v1/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: "test" }),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    const rawText = await res.text().catch(() => "");
    let parsed = null;
    try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!res.ok) {
      const detail = parsed?.error?.message || parsed?.error || rawText;
      return { ok: false, latencyMs, error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`, status: res.status };
    }
    const hasEmbedding = Array.isArray(parsed?.data) && parsed.data.length > 0 && Array.isArray(parsed.data[0]?.embedding);
    if (!hasEmbedding) {
      return { ok: false, latencyMs, status: res.status, error: "Provider returned no embedding data" };
    }
    return { ok: true, latencyMs, error: null, status: res.status };
  }

  if (kind === "image") {
    const res = await fetch(`${baseUrl}/api/v1/images/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, prompt: "test" }),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    const rawText = await res.text().catch(() => "");
    let parsed = null;
    try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!res.ok) {
      const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || rawText;
      return { ok: false, latencyMs, error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`, status: res.status };
    }

    const hasImages = Array.isArray(parsed?.data) && parsed.data.length > 0;
    if (!hasImages) {
      return { ok: false, latencyMs, status: res.status, error: "Provider returned no image data for this model" };
    }
    return { ok: true, latencyMs, error: null, status: res.status };
  }

  if (kind === "stt") {
    const form = new FormData();
    const sampleAudio = createSilentWavFile();
    form.append("file", sampleAudio, "test.wav");
    form.append("model", model);

    const res = await fetch(`${baseUrl}/api/v1/audio/transcriptions`, {
      method: "POST",
      headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "content-type")),
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    const rawText = await res.text().catch(() => "");
    let parsed = null;
    try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!res.ok) {
      const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || rawText;
      return { ok: false, latencyMs, error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`, status: res.status };
    }

    const text = typeof parsed?.text === "string" ? parsed.text : "";
    if (!text.trim()) {
      return { ok: false, latencyMs, status: res.status, error: "Provider returned no transcription text for this model" };
    }
    return { ok: true, latencyMs, error: null, status: res.status };
  }

  const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      // Claude-on-Copilot returns empty choices at max_tokens:1 (budget is spent
      // before a content token emits), so a 1-token probe yields a false negative.
      max_tokens: 16,
      stream: false,
      messages: [{ role: "user", content: "hi" }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  const rawText = await res.text().catch(() => "");
  let parsed = null;
  try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

  if (!res.ok) {
    const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || rawText;
    return { ok: false, latencyMs, error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`, status: res.status };
  }

  const providerStatus = parsed?.status;
  const providerMsg = parsed?.msg || parsed?.message;
  const hasProviderErrorStatus = providerStatus !== undefined
    && providerStatus !== null
    && String(providerStatus) !== "200"
    && String(providerStatus) !== "0";
  if (hasProviderErrorStatus && providerMsg) {
    return {
      ok: false,
      latencyMs,
      status: res.status,
      error: `Provider status ${providerStatus}: ${String(providerMsg).slice(0, 240)}`,
    };
  }

  if (parsed?.error) {
    const providerError = parsed?.error?.message || parsed?.error || "Provider returned an error";
    return {
      ok: false,
      latencyMs,
      status: res.status,
      error: String(providerError).slice(0, 240),
    };
  }

  const hasChoices = Array.isArray(parsed?.choices) && parsed.choices.length > 0;
  if (!hasChoices) {
    return {
      ok: false,
      latencyMs,
      status: res.status,
      error: "Provider returned no completion choices for this model",
    };
  }

  return { ok: true, latencyMs, error: null, status: res.status };
}
