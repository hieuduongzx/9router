import { getApiKeys } from "@/lib/localDb";

function getTestBaseUrls(request) {
  if (process.env.BASE_URL) return [process.env.BASE_URL.replace(/\/$/, "")];

  const requestUrl = new URL(request.url);
  const port = requestUrl.port || process.env.PORT || (requestUrl.protocol === "https:" ? "443" : "80");
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  const localOrigin = `http://127.0.0.1:${port}`;

  return localOrigin === origin ? [origin] : [localOrigin, origin];
}

async function fetchFirstAvailable(baseUrls, path, options) {
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      return await fetch(`${baseUrl}${path}`, options);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export async function testModel({ model, kind, request }) {
  const baseUrls = getTestBaseUrls(request);

  // Get an active internal API key for auth (if requireApiKey is enabled)
  let apiKey = null;
  try {
    const keys = await getApiKeys();
    apiKey = keys.find((k) => k.isActive !== false)?.key || null;
  } catch {}

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const start = Date.now();

  try {
    // Route to appropriate endpoint based on kind
    if (kind === "embedding") {
      const res = await fetchFirstAvailable(baseUrls, "/api/v1/embeddings", {
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

    // Default: chat completions
    const res = await fetchFirstAvailable(baseUrls, "/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 1,
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
      const error = `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`;
      return { ok: false, latencyMs, error, status: res.status };
    }

    // Some providers may return HTTP 200 but not a real completion for invalid models.
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
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message, status: null };
  }
}
