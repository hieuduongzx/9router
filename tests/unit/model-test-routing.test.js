import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiKeys: vi.fn(),
  getConsistentMachineId: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getApiKeys: mocks.getApiKeys,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
}));

const originalFetch = global.fetch;

describe("model test route kind routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiKeys.mockResolvedValue([{ key: "sk-internal", isActive: true }]);
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      created: 1,
      data: [{ b64_json: "abc" }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("routes image model tests to /api/v1/images/generations", async () => {
    const { POST } = await import("../../src/app/api/models/test/route.js");

    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hf/black-forest-labs/FLUX.1-schnell",
        kind: "image",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/images/generations"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "hf/black-forest-labs/FLUX.1-schnell",
          prompt: "test",
        }),
      })
    );
  });

  it("routes embedding model tests to /api/v1/embeddings", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [0.1, 0.2] }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");

    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "voyage/voyage-3-large",
        kind: "embedding",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/embeddings"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "voyage/voyage-3-large",
          input: "test",
        }),
      })
    );
  });

  it("fails embedding model tests when provider returns no embedding data", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: null }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");

    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "voyage/voyage-3-large",
        kind: "embedding",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.error).toBe("Provider returned no embedding data");
  });

  it("routes stt model tests to /api/v1/audio/transcriptions", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: "test",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");

    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hf/openai/whisper-small",
        kind: "stt",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/audio/transcriptions"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });

  it("returns formatted HTTP errors for non-2xx embedding responses", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "bad upstream" },
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");

    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "voyage/voyage-3-large",
        kind: "embedding",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.status).toBe(502);
    expect(body.error).toBe("HTTP 502: bad upstream");
  });

  it("verifies native web search only from provider-native structured evidence", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "openai",
      query: "test query",
      results: [{ url: "https://example.com/release", title: "Release" }],
      answer: { text: "A release happened." },
      metrics: {
        search_evidence: {
          verified: true,
          type: "web_search_call",
          search_call_count: 1,
          result_count: 1,
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");
    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        mode: "web-search",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual(expect.objectContaining({
      ok: true,
      supported: true,
      verdict: "verified",
      evidenceType: "web_search_call",
      searchCallCount: 1,
      resultCount: 1,
    }));

    const [url, options] = global.fetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(url).toContain("/api/v1/search");
    expect(payload.provider).toBe("openai");
    expect(payload.search_model).toBe("gpt-5");
    expect(payload.query).toMatch(/live public web/i);
  });

  it("ignores plausible assistant text and links without structured search evidence", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "openai",
      results: [{ url: "https://example.com", title: "Example" }],
      answer: { text: "I searched the web. [Source](https://example.com)" },
      metrics: {
        search_evidence: {
          verified: false,
          type: null,
          search_call_count: 0,
          result_count: 1,
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { POST } = await import("../../src/app/api/models/test/route.js");
    const req = new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/text-only-model",
        mode: "web-search",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.supported).toBeNull();
    expect(body.verdict).toBe("unknown");
    expect(body.error).toMatch(/assistant text was ignored/i);
  });
});
