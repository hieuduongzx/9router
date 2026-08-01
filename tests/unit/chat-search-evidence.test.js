import { afterEach, describe, expect, it, vi } from "vitest";
import { handleChatSearch } from "../../open-sse/handlers/search/chatSearch.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("chat search evidence", () => {
  it("marks an OpenAI Responses web_search_call as verified", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [
        {
          id: "ws_1",
          type: "web_search_call",
          status: "completed",
          action: {
            type: "search",
            queries: ["latest official AI release"],
            sources: [{ type: "url", url: "https://example.com/release" }],
          },
        },
        {
          type: "message",
          content: [{
            type: "output_text",
            text: "A release happened.",
            annotations: [{ type: "url_citation", url: "https://example.com/release", title: "Release" }],
          }],
        },
      ],
      usage: { total_tokens: 42 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await handleChatSearch({
      provider: "openai",
      model: "gpt-5",
      query: "latest official AI release",
      maxResults: 3,
      credentials: { apiKey: "sk-test" },
    });

    expect(result.success).toBe(true);
    expect(result.data.metrics.search_evidence).toEqual(expect.objectContaining({
      verified: true,
      type: "web_search_call",
      search_call_count: 1,
      result_count: 1,
    }));
    expect(result.data.results[0].url).toBe("https://example.com/release");

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      model: "gpt-5",
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      store: false,
    }));
  });

  it("does not verify markdown links generated only as assistant text", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "I searched it. [Source](https://example.com/hallucinated)",
          annotations: [],
        }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await handleChatSearch({
      provider: "openai",
      model: "gpt-5",
      query: "latest official AI release",
      credentials: { apiKey: "sk-test" },
    });

    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(1);
    expect(result.data.metrics.search_evidence).toEqual(expect.objectContaining({
      verified: false,
      type: null,
      search_call_count: 0,
    }));
  });

  it("verifies Anthropic server_tool_use independently of answer text", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [
        { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "release" } },
        {
          type: "web_search_tool_result",
          tool_use_id: "srv_1",
          content: [{ type: "web_search_result", url: "https://example.com/anthropic", title: "Anthropic" }],
        },
        { type: "text", text: "Result", citations: [] },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        server_tool_use: { web_search_requests: 1 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await handleChatSearch({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      query: "release",
      credentials: { apiKey: "sk-ant-test" },
    });

    expect(result.success).toBe(true);
    expect(result.data.metrics.search_evidence).toEqual(expect.objectContaining({
      verified: true,
      type: "server_tool_use",
      search_call_count: 1,
    }));
    expect(global.fetch.mock.calls[0][1].headers["x-api-key"]).toBe("sk-ant-test");
  });
});
