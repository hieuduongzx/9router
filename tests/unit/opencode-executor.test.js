/**
 * Unit tests for OpenCode Executor
 *
 * Tests cover:
 *  - URL building for different formats (openai, claude, gemini)
 *  - Header building for different formats
 *  - Request transformation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OpencodeExecutor } from "../../open-sse/executors/opencode.js";

describe("OpenCode Executor", () => {
  let zenExecutor;
  let goExecutor;

  beforeEach(() => {
    zenExecutor = new OpencodeExecutor("opencode-zen");
    goExecutor = new OpencodeExecutor("opencode-go");
  });

  describe("URL Building", () => {
    it("should build OpenAI chat completions URL for default models", () => {
      const url = zenExecutor.buildUrl("qwen3-coder-plus", true);
      expect(url).toBe("https://opencode.ai/zen/v1/chat/completions");
    });

    it("should build Claude messages URL for MiniMax models in Go tier", () => {
      const url = goExecutor.buildUrl("minimax-m2.7", true);
      expect(url).toBe("https://opencode.ai/zen/go/v1/messages");
    });

    it("should build Claude messages URL for MiniMax M2.5 in Go tier", () => {
      const url = goExecutor.buildUrl("minimax-m2.5", true);
      expect(url).toBe("https://opencode.ai/zen/go/v1/messages");
    });

    it("should build OpenAI chat completions URL for GLM in Go tier", () => {
      const url = goExecutor.buildUrl("glm-5", true);
      expect(url).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    });

    it("should build OpenAI chat completions URL for Kimi in Go tier", () => {
      const url = goExecutor.buildUrl("kimi-k2.5", true);
      expect(url).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    });
  });

  describe("Header Building", () => {
    it("should build OpenAI format headers with Bearer token", () => {
      const headers = zenExecutor.buildHeaders(
        { apiKey: "test-key", model: "qwen3-coder-plus" },
        true
      );
      expect(headers["Authorization"]).toBe("Bearer test-key");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("text/event-stream");
    });

    it("should build Claude format headers with x-api-key for MiniMax", () => {
      const headers = goExecutor.buildHeaders(
        { apiKey: "test-key", model: "minimax-m2.7" },
        true
      );
      expect(headers["x-api-key"]).toBe("test-key");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("should use accessToken if apiKey not provided", () => {
      const headers = zenExecutor.buildHeaders(
        { accessToken: "token-123", model: "qwen3-coder-plus" },
        true
      );
      expect(headers["Authorization"]).toBe("Bearer token-123");
    });
  });

  describe("Request Transformation", () => {
    it("should pass through OpenAI format unchanged", () => {
      const body = {
        model: "qwen3-coder-plus",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 100,
      };
      const result = zenExecutor.transformRequest("qwen3-coder-plus", body, true, {});
      expect(result.model).toBe("qwen3-coder-plus");
      expect(result.messages).toEqual(body.messages);
    });

    it("should transform to Claude format for MiniMax models", () => {
      const body = {
        model: "minimax-m2.7",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Hello" },
        ],
        max_tokens: 100,
        temperature: 0.7,
      };
      const result = goExecutor.transformRequest("minimax-m2.7", body, true, {});
      expect(result.model).toBe("minimax-m2.7");
      expect(result.max_tokens).toBe(100);
      expect(result.temperature).toBe(0.7);
      expect(result.system).toBe("You are a helpful assistant");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
    });
  });

  describe("Provider Configuration", () => {
    it("should have correct base URLs", () => {
      expect(zenExecutor.config.baseUrl).toBe("https://opencode.ai/zen/v1/chat/completions");
      expect(goExecutor.config.baseUrl).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    });

    it("should have testKeyBaseUrl for Go tier", () => {
      expect(goExecutor.config.testKeyBaseUrl).toBe("https://opencode.ai/zen/v1");
    });
  });
});
