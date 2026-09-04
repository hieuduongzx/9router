// Web Fetch handler — dispatches to firecrawl, jina-reader, tavily, exa, tinyfish, ollama
// Returns normalized shape across all providers

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_FORMAT = "markdown";

/**
 * @typedef {Object} FetchResult
 * @property {boolean} success
 * @property {number} [status]
 * @property {string} [error]
 * @property {Object} [data]
 */

/**
 * Fetch with timeout abort.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 */
// Strip non-ASCII chars from header values (HTTP headers must be ByteString).
function sanitizeHeaders(headers) {
  if (!headers) return headers;
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = typeof v === "string" ? v.replace(/[^\x00-\xFF]/g, "").trim() : v;
  }
  return out;
}

async function tryFetch(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers: sanitizeHeaders(init.headers), signal: ctrl.signal });
    return { ok: true, res };
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    return { ok: false, timeout: isAbort, error: err?.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text, max) {
  if (!text || typeof text !== "string") return text || "";
  if (!max || max <= 0) return text;
  return text.length > max ? text.slice(0, max) : text;
}

function parseJinaTitle(text) {
  const source = String(text || "");
  const metadataTitle = source.match(/^\s*Title:\s*(.+)$/mi);
  if (metadataTitle) return metadataTitle[1].trim();
  const m = source.match(/^\s*#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function buildData({ provider, url, title, format, text, links, costUsd, responseMs, upstreamMs }) {
  const data = {
    provider,
    url,
    title: title || null,
    content: { format, text: text || "", length: (text || "").length },
    metadata: { author: null, published_at: null, language: null },
    usage: { fetch_cost_usd: costUsd ?? null },
    metrics: { response_time_ms: responseMs, upstream_latency_ms: upstreamMs }
  };
  if (Array.isArray(links)) data.links = links;
  return data;
}

async function readJsonOrText(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return { json: await res.json() }; } catch { return { text: "" }; }
  }
  return { text: await res.text() };
}

/**
 * Main handler.
 * @param {Object} params
 * @param {string} params.url
 * @param {string} [params.format]
 * @param {number} [params.maxCharacters]
 * @param {string} params.provider
 * @param {Object} [params.providerConfig]
 * @param {Object} [params.credentials]
 * @param {Function} [params.log]
 * @returns {Promise<FetchResult>}
 */
export async function handleFetchCore({ url, format, maxCharacters, provider, providerConfig, credentials, log }) {
  if (!url || typeof url !== "string") {
    return { success: false, status: 400, error: "url is required" };
  }
  if (!provider) {
    return { success: false, status: 400, error: "provider is required" };
  }

  const fmt = format || DEFAULT_FORMAT;
  const timeoutMs = providerConfig?.timeoutMs || DEFAULT_TIMEOUT_MS;
  const apiKey = credentials?.apiKey || credentials?.key || credentials?.token || "";
  const costPerQuery = providerConfig?.costPerQuery ?? null;
  const startedAt = Date.now();

  try {
    if (provider === "firecrawl") {
      return await runFirecrawl({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt });
    }
    if (provider === "jina-reader") {
      return await runJina({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt });
    }
    if (provider === "tavily") {
      return await runTavily({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt });
    }
    if (provider === "exa") {
      return await runExa({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt });
    }
    if (provider === "tinyfish") {
      return await runTinyfish({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt });
    }
    if (provider === "ollama") {
      return await runOllama({
        url,
        fmt,
        timeoutMs,
        apiKey,
        maxCharacters,
        costPerQuery,
        startedAt,
        baseUrl: providerConfig?.baseUrl,
      });
    }
    return { success: false, status: 400, error: `Unsupported provider: ${provider}` };
  } catch (err) {
    log?.("fetch handler error:", err?.message || err);
    return { success: false, status: 502, error: err?.message || "Internal fetch error" };
  }
}

async function runFirecrawl({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt }) {
  const upstreamStart = Date.now();
  const r = await tryFetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ url, formats: [fmt] })
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const { json } = await readJsonOrText(r.res);
  if (!r.res.ok) {
    return { success: false, status: r.res.status, error: json?.error || `Firecrawl error: ${r.res.status}` };
  }
  const d = json?.data || {};
  const text = truncate(d.markdown || d.html || d.text || "", maxCharacters);
  const title = d.metadata?.title || null;
  return {
    success: true,
    data: buildData({
      provider: "firecrawl", url, title, format: fmt, text,
      costUsd: costPerQuery, responseMs: Date.now() - startedAt, upstreamMs
    })
  };
}

async function runJina({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt }) {
  const upstreamStart = Date.now();
  const r = await tryFetch("https://r.jina.ai/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ url })
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const body = await r.res.text();
  if (!r.res.ok) {
    return { success: false, status: r.res.status, error: body?.slice(0, 500) || `Jina error: ${r.res.status}` };
  }
  const text = truncate(body, maxCharacters);
  return {
    success: true,
    data: buildData({
      provider: "jina-reader", url, title: parseJinaTitle(body), format: fmt, text,
      costUsd: costPerQuery, responseMs: Date.now() - startedAt, upstreamMs
    })
  };
}

async function runTavily({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt }) {
  const upstreamStart = Date.now();
  const r = await tryFetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ urls: [url], extract_depth: "basic" })
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const { json } = await readJsonOrText(r.res);
  if (!r.res.ok) {
    return { success: false, status: r.res.status, error: json?.error || `Tavily error: ${r.res.status}` };
  }
  const first = json?.results?.[0] || {};
  const text = truncate(first.raw_content || "", maxCharacters);
  return {
    success: true,
    data: buildData({
      provider: "tavily", url, title: null, format: fmt, text,
      costUsd: costPerQuery, responseMs: Date.now() - startedAt, upstreamMs
    })
  };
}

async function runExa({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt }) {
  const upstreamStart = Date.now();
  const r = await tryFetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({ ids: [url], text: true })
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const { json } = await readJsonOrText(r.res);
  if (!r.res.ok) {
    return { success: false, status: r.res.status, error: json?.error || `Exa error: ${r.res.status}` };
  }
  const first = json?.results?.[0] || {};
  const text = truncate(first.text || "", maxCharacters);
  return {
    success: true,
    data: buildData({
      provider: "exa", url, title: first.title || null, format: fmt, text,
      costUsd: costPerQuery, responseMs: Date.now() - startedAt, upstreamMs
    })
  };
}

/**
 * TinyFish Fetch API — POST https://api.fetch.tinyfish.ai
 * Auth: X-API-Key. Docs: https://docs.tinyfish.ai/fetch-api
 * Free tier (no credits). Supports markdown | html | json.
 */
async function runTinyfish({ url, fmt, timeoutMs, apiKey, maxCharacters, costPerQuery, startedAt }) {
  // TinyFish format enum: markdown | html | json (default markdown)
  const format = ["markdown", "html", "json"].includes(fmt) ? fmt : "markdown";
  const upstreamStart = Date.now();
  const r = await tryFetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify({
      urls: [url],
      format,
      // Prefer live content for tool use; origin Cache-Control can still apply
      ttl: 0,
      per_url_timeout_ms: Math.min(Math.max(timeoutMs || DEFAULT_TIMEOUT_MS, 1000), 110000),
    }),
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const { json } = await readJsonOrText(r.res);
  if (!r.res.ok) {
    const msg = json?.error?.message || json?.error || `TinyFish error: ${r.res.status}`;
    return { success: false, status: r.res.status, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }

  // Per-URL errors do not fail the whole response
  const perUrlErr = Array.isArray(json?.errors)
    ? json.errors.find((e) => e?.url === url || !url)
    : null;
  if (perUrlErr && (!json?.results || json.results.length === 0)) {
    return {
      success: false,
      status: perUrlErr.status || 502,
      error: `TinyFish fetch failed: ${perUrlErr.error || "unknown"}`,
    };
  }

  const first = json?.results?.[0] || {};
  let rawText = first.text;
  if (rawText && typeof rawText === "object") {
    rawText = JSON.stringify(rawText, null, 2);
  }
  const text = truncate(typeof rawText === "string" ? rawText : "", maxCharacters);

  return {
    success: true,
    data: {
      ...buildData({
        provider: "tinyfish",
        url: first.final_url || first.url || url,
        title: first.title || null,
        format,
        text,
        costUsd: costPerQuery,
        responseMs: Date.now() - startedAt,
        upstreamMs: first.latency_ms ?? upstreamMs,
      }),
      metadata: {
        author: first.author || null,
        published_at: first.published_date || null,
        language: first.language || null,
        description: first.description || null,
      },
    },
  };
}

async function runOllama({
  url,
  fmt,
  timeoutMs,
  apiKey,
  maxCharacters,
  costPerQuery,
  startedAt,
  baseUrl,
}) {
  const upstreamStart = Date.now();
  const r = await tryFetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ url })
  }, timeoutMs);

  if (!r.ok) {
    return { success: false, status: r.timeout ? 504 : 502, error: r.error };
  }
  const upstreamMs = Date.now() - upstreamStart;
  const { json, text: responseText } = await readJsonOrText(r.res);
  if (!r.res.ok) {
    const error = json?.error
      || json?.message
      || responseText?.slice(0, 500)
      || `Ollama error: ${r.res.status}`;
    return { success: false, status: r.res.status, error };
  }
  if (!json || typeof json.content !== "string") {
    return { success: false, status: 502, error: "Ollama returned an empty or invalid web fetch response" };
  }

  const text = truncate(json.content, maxCharacters);
  return {
    success: true,
    data: buildData({
      provider: "ollama",
      url,
      title: json.title || null,
      format: fmt,
      text,
      links: json.links,
      costUsd: costPerQuery,
      responseMs: Date.now() - startedAt,
      upstreamMs
    })
  };
}
