/**
 * Wrap chat-completions endpoints (with built-in web search) into the unified
 * /v1/search response format. Supports gemini, openai, xai, kimi, minimax, perplexity.
 */
import { PROVIDER_MEDIA } from "../../providers/index.js";

// Default search model + endpoint derive from registry searchViaChat (single source)
const searchModel = (id) => PROVIDER_MEDIA[id]?.searchViaChat?.defaultModel;
const searchEndpoint = (id, model) =>
  (PROVIDER_MEDIA[id]?.searchViaChat?.endpoint || "").replace("{model}", model || "");

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RESULTS = 10;

/** Push a citation-like object if it has a URL. */
function pushCitation(list, raw) {
  if (!raw) return;
  if (typeof raw === "string") {
    if (/^https?:\/\//i.test(raw)) list.push({ url: raw, title: "", snippet: "" });
    return;
  }
  const url = raw.url || raw.link || raw.uri || raw.href;
  if (!url || typeof url !== "string") return;
  list.push({
    url,
    title: raw.title || raw.name || "",
    snippet: raw.snippet || raw.summary || raw.description || raw.text || "",
  });
}

/** Walk arbitrary nested values looking for citation-shaped objects / URL lists. */
function collectCitationShaped(value, out, depth = 0) {
  if (!value || depth > 6) return;
  if (typeof value === "string") {
    pushCitation(out, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectCitationShaped(v, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  // Prefer known keys
  if (value.url || value.link || value.uri) {
    pushCitation(out, value);
  }
  for (const [k, v] of Object.entries(value)) {
    if (/citation|result|source|annotat/i.test(k)) {
      collectCitationShaped(v, out, depth + 1);
    } else if (k === "content" || k === "output" || k === "action" || k === "parts") {
      collectCitationShaped(v, out, depth + 1);
    }
  }
}

/**
 * Parse structured search hits from LLM text:
 * 1) JSON array of {title,url,snippet}
 * 2) Markdown links [title](url)
 */
function parseStructuredHitsFromText(text) {
  if (!text || typeof text !== "string") return [];
  const hits = [];

  // Fenced or raw JSON array
  const jsonMatch =
    text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i) ||
    text.match(/(\[\s*\{[\s\S]*?"url"[\s\S]*?\}\s*\])/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]);
      if (Array.isArray(arr)) {
        for (const item of arr) pushCitation(hits, item);
      }
    } catch {
      /* ignore parse errors */
    }
  }

  // Markdown links
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = mdRe.exec(text)) !== null) {
    hits.push({ url: m[2], title: m[1], snippet: "" });
  }

  // Bare URLs
  if (!hits.length) {
    const urlRe = /https?:\/\/[^\s)\]"'<>]+/g;
    while ((m = urlRe.exec(text)) !== null) {
      hits.push({ url: m[0].replace(/[.,;:]+$/, ""), title: "", snippet: "" });
    }
  }

  const seen = new Set();
  return hits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

/** Extract answer + citations from OpenAI Responses API `output[]` (xAI / Grok CLI). */
function extractResponsesApiAnswer(data) {
  const output = Array.isArray(data?.output) ? data.output : [];
  let text = "";
  const citations = [];

  // Top-level citations (xAI SDK / Responses variants)
  if (Array.isArray(data?.citations)) {
    for (const c of data.citations) pushCitation(citations, c);
  }
  if (Array.isArray(data?.sources)) {
    for (const c of data.sources) pushCitation(citations, c);
  }

  for (const item of output) {
    const type = typeof item?.type === "string" ? item.type : "";

    // Hosted web_search tool results (several shapes seen in the wild)
    if (
      type === "web_search_call" ||
      type === "web_search" ||
      type === "server_tool_use" ||
      type.includes("web_search") ||
      type.includes("search")
    ) {
      collectCitationShaped(item, citations);
    }

    // Message content + url_citation annotations
    const parts = Array.isArray(item?.content) ? item.content : [];
    for (const p of parts) {
      if (typeof p?.text === "string") text += p.text;
      if (typeof p === "string") text += p;
      const anns = Array.isArray(p?.annotations) ? p.annotations : [];
      for (const a of anns) {
        pushCitation(citations, a?.url ? a : a?.url_citation || a);
      }
    }
    if (typeof item?.text === "string") text += item.text;
    if (Array.isArray(item?.annotations)) {
      for (const a of item.annotations) {
        pushCitation(citations, a?.url ? a : a?.url_citation || a);
      }
    }
  }

  // Fallback: structured JSON / markdown links in the model text
  if (!citations.length && text) {
    for (const h of parseStructuredHitsFromText(text)) pushCitation(citations, h);
  }

  // Dedupe by URL
  const seen = new Set();
  const unique = [];
  for (const c of citations) {
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    unique.push(c);
  }
  const tokens = data?.usage?.total_tokens || data?.usage?.output_tokens || 0;
  return { text, citations: unique, tokens };
}

/**
 * Normalize a citation entry into the unified result shape.
 * @param {{url:string, title?:string, snippet?:string}} c
 * @param {number} index
 * @param {string} provider
 * @param {string} retrievedAt
 */
function toResult(c, index, provider, retrievedAt) {
  return {
    title: c.title || "",
    url: c.url,
    snippet: c.snippet || "",
    position: index + 1,
    score: null,
    published_at: null,
    favicon_url: null,
    content: null,
    metadata: {},
    citation: { provider, retrieved_at: retrievedAt, rank: index + 1 },
    provider_raw: null
  };
}

/** Coerce a citation that might be a raw URL string or an object. */
function normalizeCitation(c) {
  if (!c) return null;
  if (typeof c === "string") return { url: c };
  if (typeof c === "object" && c.url) return c;
  return null;
}

/**
 * Provider-specific configuration map. All providers must implement:
 * { endpoint, defaultModel, buildBody, buildHeaders, extractAnswer }
 */
const CHAT_SEARCH_CONFIG = {
  gemini: {
    endpoint: (model) => searchEndpoint("gemini", model),
    buildBody: (query) => ({
      contents: [{ role: "user", parts: [{ text: query }] }],
      tools: [{ google_search: {} }]
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      "x-goog-api-key": token
    }),
    extractAnswer: (data) => {
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const text = parts.map((p) => p?.text || "").filter(Boolean).join("");
      const chunks = candidate?.groundingMetadata?.groundingChunks || [];
      const citations = chunks
        .map((ch) => ch?.web)
        .filter(Boolean)
        .map((w) => ({ url: w.uri || w.url, title: w.title || "" }))
        .filter((c) => c.url);
      const tokens = data?.usageMetadata?.totalTokenCount || 0;
      return { text, citations, tokens };
    }
  },

  openai: {
    endpoint: () => searchEndpoint("openai"),
    buildBody: (query, model) => {
      const body = {
        model,
        messages: [{ role: "user", content: query }]
      };
      // Non-search-preview models need explicit web_search tool
      if (!/search/i.test(model)) {
        body.tools = [{ type: "web_search" }];
      }
      return body;
    },
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: (data) => {
      const msg = data?.choices?.[0]?.message || {};
      const text = msg.content || "";
      const annotations = Array.isArray(msg.annotations) ? msg.annotations : [];
      const fromAnn = annotations
        .map((a) => a?.url_citation)
        .filter(Boolean)
        .map((u) => ({ url: u.url, title: u.title || "" }));
      const fromTop = Array.isArray(data?.citations)
        ? data.citations.map(normalizeCitation).filter(Boolean)
        : [];
      const citations = fromAnn.length ? fromAnn : fromTop;
      const tokens = data?.usage?.total_tokens || 0;
      return { text, citations, tokens };
    }
  },

  xai: {
    endpoint: () => searchEndpoint("xai"),
    buildBody: (query, model) => ({
      model,
      input: [{ role: "user", content: query }],
      tools: [{ type: "web_search" }],
      stream: false,
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: extractResponsesApiAnswer,
  },

  kimi: {
    endpoint: () => searchEndpoint("kimi"),
    buildBody: (query, model) => ({
      model,
      messages: [{ role: "user", content: query }],
      tools: [
        { type: "builtin_function", function: { name: "$web_search" } }
      ]
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: (data) => {
      const msg = data?.choices?.[0]?.message || {};
      const text = msg.content || "";
      const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      const citations = [];
      for (const call of calls) {
        const argStr = call?.function?.arguments;
        if (!argStr) continue;
        let parsed;
        try {
          parsed = typeof argStr === "string" ? JSON.parse(argStr) : argStr;
        } catch {
          continue;
        }
        const items =
          parsed?.search_results ||
          parsed?.results ||
          parsed?.references ||
          [];
        if (Array.isArray(items)) {
          for (const it of items) {
            const url = it?.url || it?.link;
            if (!url) continue;
            citations.push({
              url,
              title: it.title || "",
              snippet: it.snippet || it.summary || ""
            });
          }
        }
      }
      const tokens = data?.usage?.total_tokens || 0;
      return { text, citations, tokens };
    }
  },

  minimax: {
    endpoint: () => searchEndpoint("minimax"),
    buildBody: (query, model) => ({
      model,
      messages: [{ role: "user", content: query }],
      tools: [{ type: "web_search" }]
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: (data) => {
      const msg = data?.choices?.[0]?.message || {};
      const text = msg.content || "";
      const citations = [];
      const direct = Array.isArray(data?.web_search_results)
        ? data.web_search_results
        : [];
      for (const it of direct) {
        const url = it?.url || it?.link;
        if (url) {
          citations.push({
            url,
            title: it.title || "",
            snippet: it.snippet || it.summary || ""
          });
        }
      }
      if (!citations.length) {
        const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        for (const call of calls) {
          const argStr = call?.function?.arguments;
          if (!argStr) continue;
          let parsed;
          try {
            parsed = typeof argStr === "string" ? JSON.parse(argStr) : argStr;
          } catch {
            continue;
          }
          const items = parsed?.results || parsed?.search_results || [];
          if (Array.isArray(items)) {
            for (const it of items) {
              const url = it?.url || it?.link;
              if (!url) continue;
              citations.push({
                url,
                title: it.title || "",
                snippet: it.snippet || ""
              });
            }
          }
        }
      }
      const tokens = data?.usage?.total_tokens || 0;
      return { text, citations, tokens };
    }
  },

  perplexity: {
    endpoint: () => searchEndpoint("perplexity"),
    buildBody: (query, model) => ({
      model,
      messages: [{ role: "user", content: query }]
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: (data) => {
      const msg = data?.choices?.[0]?.message || {};
      const text = msg.content || "";
      const raw = data?.citations || [];
      const citations = Array.isArray(raw)
        ? raw.map(normalizeCitation).filter(Boolean)
        : [];
      const tokens = data?.usage?.total_tokens || 0;
      return { text, citations, tokens };
    }
  },

  "perplexity-agent": {
    endpoint: () => searchEndpoint("perplexity-agent"),
    buildBody: (query, model) => ({
      model,
      input: query,
      tools: [{ type: "web_search" }]
    }),
    buildHeaders: (token) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    extractAnswer: (data) => {
      const output = Array.isArray(data?.output) ? data.output : [];
      let text = "";
      const citations = [];
      for (const item of output) {
        const parts = Array.isArray(item?.content) ? item.content : [];
        for (const p of parts) {
          if (typeof p?.text === "string") text += p.text;
          const anns = Array.isArray(p?.annotations) ? p.annotations : [];
          for (const a of anns) {
            const c = normalizeCitation(a?.url ? a : a?.url_citation);
            if (c) citations.push(c);
          }
        }
        const results = Array.isArray(item?.results) ? item.results : [];
        for (const r of results) {
          const url = r?.url || r?.link;
          if (!url) continue;
          citations.push({
            url,
            title: r?.title || "",
            snippet: r?.snippet || ""
          });
        }
      }
      if (!citations.length && Array.isArray(data?.citations)) {
        for (const c of data.citations) {
          const n = normalizeCitation(c);
          if (n) citations.push(n);
        }
      }
      const tokens = data?.usage?.total_tokens || 0;
      return { text, citations, tokens };
    }
  }
};

/**
 * Execute a chat-search request against the chosen provider.
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.query
 * @param {number} [params.maxResults]
 * @param {string} [params.model]
 * @param {{apiKey?:string, accessToken?:string}} params.credentials
 * @param {{info?:Function, warn?:Function, error?:Function}} [params.log]
 * @returns {Promise<{success:boolean, status?:number, error?:string, data?:object}>}
 */
export async function handleChatSearch({
  provider,
  query,
  maxResults,
  model,
  credentials,
  log
}) {
  const startTime = Date.now();
  const cfg = CHAT_SEARCH_CONFIG[provider];

  if (!cfg) {
    return {
      success: false,
      status: 400,
      error: `Unsupported chat-search provider: ${provider}`
    };
  }

  if (!query || typeof query !== "string") {
    return { success: false, status: 400, error: "Missing query" };
  }

  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) {
    return {
      success: false,
      status: 401,
      error: "Missing credentials (apiKey or accessToken)"
    };
  }

  const limit =
    Number.isFinite(maxResults) && maxResults > 0
      ? Math.floor(maxResults)
      : DEFAULT_MAX_RESULTS;
  const useModel = model || searchModel(provider);
  const url = cfg.endpoint(useModel);
  const body = cfg.buildBody(query, useModel);
  const headers = cfg.buildHeaders(token);

  const controller = new AbortController();
  const timeoutMs = cfg.timeoutMs || REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let upstreamStart = Date.now();
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      log?.warn?.(`[chatSearch] timeout provider=${provider}`);
      return { success: false, status: 504, error: "Upstream timeout" };
    }
    log?.error?.(`[chatSearch] network error provider=${provider}: ${err?.message}`);
    return {
      success: false,
      status: 502,
      error: `Network error: ${err?.message || "unknown"}`
    };
  }
  clearTimeout(timer);
  const upstreamLatency = Date.now() - upstreamStart;

  let data;
  try {
    data = await resp.json();
  } catch {
    return {
      success: false,
      status: 502,
      error: `Invalid upstream response (status ${resp.status})`
    };
  }

  if (!resp.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `Upstream HTTP ${resp.status}`;
    log?.warn?.(`[chatSearch] upstream error provider=${provider} status=${resp.status}`);
    return {
      success: false,
      status: resp.status,
      error: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)
    };
  }

  const { text, citations, tokens } = cfg.extractAnswer(data);
  const retrievedAt = new Date().toISOString();
  const limited = (citations || []).slice(0, limit);
  const results = limited.map((c, i) => toResult(c, i, provider, retrievedAt));

  return {
    success: true,
    status: 200,
    data: {
      provider,
      query,
      results,
      answer: { source: provider, text: text || "", model: useModel },
      usage: { queries_used: 1, search_cost_usd: 0, llm_tokens: tokens || 0 },
      metrics: {
        response_time_ms: Date.now() - startTime,
        upstream_latency_ms: upstreamLatency,
        total_results_available: null
      },
      errors: []
    }
  };
}

export { CHAT_SEARCH_CONFIG };
