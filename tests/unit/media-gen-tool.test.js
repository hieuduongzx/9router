import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/sse/services/auth.js", () => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
}));

vi.mock("../../src/sse/services/model.js", () => ({
  getModelInfo: vi.fn(),
}));

vi.mock("../../src/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: vi.fn(),
  updateProviderCredentials: vi.fn(),
}));

vi.mock("open-sse/handlers/imageGenerationCore.js", () => ({
  handleImageGenerationCore: vi.fn(),
}));

vi.mock("open-sse/config/runtimeConfig.js", () => ({
  HTTP_STATUS: { SERVICE_UNAVAILABLE: 503, BAD_REQUEST: 400 },
}));

vi.mock("open-sse/providers/registry/index.js", () => ({
  default: [],
}));

import {
  mediaGenArgsToImageBody,
  normalizeMediaGenBody,
  extractPendingMediaGenCalls,
  formatToolResultImages,
  buildMediaGenToolMessage,
} from "../../src/sse/services/mediaGenTool.js";

const EDIT_ARGS = {
  action: "edit_image",
  image_urls: [
    "https://cdn.discordapp.com/attachments/1114480056400613417/1534894695514243142/generated_image.png?ex=6a75c994&is=6a747814&hm=abc&",
  ],
  prompt:
    "Change the man's outfit to a sleeveless tank top (áo ba lỗ): remove the sleeves so his shoulders and arms are bare, keep the same style and color of the shirt otherwise. Preserve all other original details, style, and composition of the image.",
};

describe("mediaGenTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps media_gen edit args with an image_urls array into the gateway image body", () => {
    const body = mediaGenArgsToImageBody(EDIT_ARGS);
    expect(body.prompt).toContain("sleeveless tank top");
    expect(body.image).toBe(EDIT_ARGS.image_urls[0]);
    expect(body.image_urls).toBeUndefined();
  });

  it("passes multiple reference images via the images array and first as image", () => {
    const args = {
      action: "edit_image",
      image_urls: ["https://a.example/1.png", "https://b.example/2.png", "https://c.example/3.png"],
      prompt: "Combine the subject from the first image into the scene of the second.",
    };
    const body = mediaGenArgsToImageBody(args);
    expect(body.image).toBe("https://a.example/1.png");
    expect(body.images).toEqual(["https://a.example/1.png", "https://b.example/2.png", "https://c.example/3.png"]);
  });

  it("passes through n/size/quality and coerces n to a number", () => {
    const body = mediaGenArgsToImageBody({ prompt: "x", n: "2", size: "1024x1024", quality: "high" });
    expect(body.n).toBe(2);
    expect(body.size).toBe("1024x1024");
    expect(body.quality).toBe("high");
  });

  it("normalizes a bare args_preview string body on the image endpoint", () => {
    const body = normalizeMediaGenBody({
      model: "codex/gpt-5.4-image",
      args_preview: JSON.stringify(EDIT_ARGS),
    });
    expect(body.model).toBe("codex/gpt-5.4-image");
    expect(body.prompt).toContain("sleeveless tank top");
    expect(body.image).toBe(EDIT_ARGS.image_urls[0]);
    expect(body.args_preview).toBeUndefined();
  });

  it("keeps standard OpenAI image bodies untouched", () => {
    const body = normalizeMediaGenBody({ model: "openai/gpt-image-1", prompt: "a cat", n: 1 });
    expect(body).toEqual({ model: "openai/gpt-image-1", prompt: "a cat", n: 1 });
  });

  it("extracts a pending ChatGPT-format media_gen call (tool + args_preview)", () => {
    const messages = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Edit this image please." },
      {
        role: "assistant",
        tool: "media_gen",
        args_preview: JSON.stringify(EDIT_ARGS),
      },
    ];
    const calls = extractPendingMediaGenCalls(messages);
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe("chatgpt");
    expect(calls[0].args.image_urls).toHaveLength(1);
    expect(calls[0].args.prompt).toContain("sleeveless tank top");
  });

  it("skips a media_gen call that already has a tool result", () => {
    const messages = [
      {
        role: "assistant",
        tool: "media_gen",
        args_preview: JSON.stringify(EDIT_ARGS),
      },
      { role: "tool", tool: "media_gen", result: "{\"data\":[{\"url\":\"https://x/out.png\"}]}" },
    ];
    expect(extractPendingMediaGenCalls(messages)).toHaveLength(0);
  });

  it("extracts an OpenAI tool_calls shape and skips when a tool message matches", () => {
    const messages = [
      {
        role: "assistant",
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "media_gen", arguments: JSON.stringify(EDIT_ARGS) } },
        ],
      },
    ];
    const pending = extractPendingMediaGenCalls(messages);
    expect(pending).toHaveLength(1);
    expect(pending[0].callId).toBe("call_1");

    const withResult = [
      ...messages,
      { role: "tool", tool_call_id: "call_1", content: "done" },
    ];
    expect(extractPendingMediaGenCalls(withResult)).toHaveLength(0);
  });

  it("extracts a Claude tool_use shape", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me do that." },
          { type: "tool_use", id: "toolu_1", name: "media_gen", input: EDIT_ARGS },
        ],
      },
    ];
    const calls = extractPendingMediaGenCalls(messages);
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe("claude");
    expect(calls[0].callId).toBe("toolu_1");
  });

  it("formats b64/url results into data URIs for the tool result", () => {
    const images = formatToolResultImages({ data: [{ b64_json: "AAAA" }, { url: "https://x/out.png" }] });
    expect(images).toHaveLength(2);
    expect(images[0].url).toBe("data:image/png;base64,AAAA");
    expect(images[1].url).toBe("https://x/out.png");
  });

  it("builds an OpenAI tool result referencing the call id", () => {
    const msg = buildMediaGenToolMessage("openai", "call_1", [{ url: "data:image/png;base64,AAAA" }]);
    expect(msg.role).toBe("tool");
    expect(msg.tool_call_id).toBe("call_1");
    expect(msg.content).toContain("data:image/png;base64,AAAA");
  });

  it("builds an error tool result without throwing", () => {
    const msg = buildMediaGenToolMessage("openai", "call_1", [], "provider down");
    expect(msg.content).toContain("media_gen failed");
  });
});
