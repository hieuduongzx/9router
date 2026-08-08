// Server-side execution of the `media_gen` tool (ChatGPT desktop format).
//
// The gateway relays chat tool_calls to upstream LLMs verbatim; it never
// executes them. Some clients (ChatGPT-style) send an assistant message with
// `tool: "media_gen"` / `args_preview` and expect the *server* to run the
// image generation. This module detects those pending calls in a chat request,
// executes them through the image-generation pipeline (handleImageGenerationCore),
// and injects the result back as a tool-result message so the upstream model
// continues the conversation with the generated image in context.
//
// Recognized tool shapes:
//   - OpenAI:     msg.tool_calls[].function.name === "media_gen" | "image_generation"
//   - ChatGPT:    msg.tool === "media_gen", args in msg.args_preview / msg.args
//   - Claude:     msg.content[].type === "tool_use", name "media_gen" | "image_generation"
//
// The `image_urls` array in edit args maps to the gateway's own multi-image
// fields: `image` (first ref, adapters that take a single image) + `images`
// (full array, adapters that support multiple references).

import {
  getProviderCredentials,
  markAccountUnavailable,
  clearAccountError,
} from "./auth.js";
import { getModelInfo } from "./model.js";
import { checkAndRefreshToken, updateProviderCredentials } from "./tokenRefresh.js";
import { handleImageGenerationCore } from "open-sse/handlers/imageGenerationCore.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import REGISTRY from "open-sse/providers/registry/index.js";

const MEDIA_GEN_TOOL_NAMES = new Set(["media_gen", "image_generation"]);

// Providers that run without credentials (same set as imageGeneration.js)
const NO_AUTH_PROVIDERS = new Set(["sdwebui", "comfyui"]);

// Curated list used to auto-pick a default image provider when neither the
// tool args nor the mediaGenModel setting name one. Ordered by usefulness.
const IMAGE_PROVIDER_CANDIDATES = [
  "codex",
  "openai",
  "gemini",
  "nanobanana",
  "fal-ai",
  "cloudflare-ai",
  "stability-ai",
  "recraft",
  "venice",
  "black-forest-labs",
  "minimax",
  "openrouter",
  "tokenrouter",
  "antigravity",
];

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function firstImageModel(providerId) {
  const entry = REGISTRY.find((e) => e.id === providerId);
  const models = entry?.models || [];
  return models.find((m) => m.kind === "image") || null;
}

/**
 * Map `media_gen` tool args → OpenAI-compatible image request body.
 * Multiple reference images become `images` (array) with `image` set to the
 * first entry for adapters that only accept a single reference.
 */
export function mediaGenArgsToImageBody(args) {
  const refs = [];
  if (Array.isArray(args.image_urls)) refs.push(...args.image_urls.filter(Boolean));
  if (Array.isArray(args.images)) refs.push(...args.images.filter(Boolean));
  if (typeof args.image_urls === "string") refs.push(args.image_urls);
  if (typeof args.image === "string" && !refs.includes(args.image)) refs.push(args.image);

  const body = { prompt: String(args.prompt ?? "").trim() };
  if (refs[0]) body.image = refs[0];
  if (refs.length > 1) body.images = refs;
  if (args.mask_image || args.mask) body.mask_image = args.mask_image || args.mask;

  for (const key of ["size", "quality", "background", "style", "image_detail", "output_format", "response_format"]) {
    if (args[key] !== undefined && args[key] !== null && args[key] !== "") body[key] = args[key];
  }
  if (args.n !== undefined) {
    const n = Number(args.n);
    if (Number.isFinite(n) && n > 0) body.n = n;
  }
  return body;
}

/**
 * Accept the ChatGPT `media_gen` body shape on the image endpoints:
 * either a bare `args_preview` JSON string, or `action`/`image_urls` fields.
 * Returns the normalized OpenAI-style body.
 */
export function normalizeMediaGenBody(body) {
  if (!body || typeof body !== "object") return body;
  let b = body;
  if (typeof body.args_preview === "string") {
    const parsed = parseArgs(body.args_preview);
    b = { ...body, ...parsed };
    delete b.args_preview;
  }
  if (b.action === undefined && b.image_urls === undefined && b.images === undefined) return b;

  const refs = [];
  if (Array.isArray(b.image_urls)) refs.push(...b.image_urls.filter(Boolean));
  if (Array.isArray(b.images)) refs.push(...b.images.filter(Boolean));
  if (typeof b.image_urls === "string") refs.push(b.image_urls);
  if (refs[0] && !b.image) b.image = refs[0];
  if (refs.length > 1 && !b.images) b.images = refs;
  return b;
}

/**
 * Find pending `media_gen` tool calls in a chat request — assistant messages
 * that carry a media_gen call but have no matching tool result after them.
 * @returns {Array<{messageIndex: number, callId: string, args: object, kind: string}>}
 */
export function extractPendingMediaGenCalls(messages) {
  const calls = [];
  if (!Array.isArray(messages)) return calls;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;

    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const fn = tc?.function || {};
        if (!MEDIA_GEN_TOOL_NAMES.has(fn.name)) continue;
        const callId = tc.id || `call_media_gen_${i}_${Date.now()}`;
        if (hasResultForCall(messages, i, callId, null)) continue;
        calls.push({ messageIndex: i, callId, args: parseArgs(fn.arguments), kind: "openai" });
      }
      continue;
    }

    if (msg.role === "assistant" && typeof msg.tool === "string" && MEDIA_GEN_TOOL_NAMES.has(msg.tool)) {
      const callId = msg.tool_call_id || `call_media_gen_${i}_${Date.now()}`;
      if (hasResultForCall(messages, i, null, msg.tool)) continue;
      calls.push({ messageIndex: i, callId, args: parseArgs(msg.args_preview ?? msg.args), kind: "chatgpt" });
      continue;
    }

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type !== "tool_use" || !MEDIA_GEN_TOOL_NAMES.has(block.name)) continue;
        const callId = block.id || `call_media_gen_${i}_${Date.now()}`;
        if (hasResultForCall(messages, i, callId, null)) continue;
        calls.push({ messageIndex: i, callId, args: parseArgs(block.input), kind: "claude" });
      }
    }
  }
  return calls;
}

function hasResultForCall(messages, fromIndex, callId, chatgptToolName) {
  for (let j = fromIndex + 1; j < messages.length; j++) {
    const m = messages[j];
    if (!m || typeof m !== "object") continue;
    if (chatgptToolName && m.role === "tool" && m.tool === chatgptToolName && m.result !== undefined) return true;
    if (callId && m.tool_call_id === callId) return true;
    if (callId && Array.isArray(m.content) && m.content.some((b) => b?.type === "tool_result" && b.tool_use_id === callId)) return true;
  }
  return false;
}

/**
 * Normalize the image-generation result into `[{ url: <data URI or http url> }]`
 * so it can be embedded in a tool-result message.
 */
export function formatToolResultImages(data) {
  if (!data?.data || !Array.isArray(data.data)) return [];
  return data.data
    .map((item) => {
      if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
      if (item?.url) return { url: item.url };
      return null;
    })
    .filter(Boolean);
}

/**
 * Build a tool-result message in the shape matching the original tool call.
 */
export function buildMediaGenToolMessage(kind, callId, images, error) {
  if (error) {
    const text = `media_gen failed: ${error}`;
    if (kind === "claude") {
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: callId, is_error: true, content: [{ type: "text", text }] }],
      };
    }
    if (kind === "chatgpt") {
      return { role: "tool", tool: "media_gen", result: JSON.stringify({ error }) };
    }
    return { role: "tool", tool_call_id: callId, content: text };
  }

  if (kind === "claude") {
    const content = [{ type: "text", text: `Generated image${images.length > 1 ? "s" : ""}.` }];
    for (const img of images) {
      const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(img.url || "");
      if (m) {
        content.push({ type: "image", source: { type: "base64", media_type: m[1] === "jpg" ? "jpeg" : m[1], data: m[2] } });
      } else if (img.url) {
        content.push({ type: "image", source: { type: "url", url: img.url } });
      }
    }
    return { role: "user", content: [{ type: "tool_result", tool_use_id: callId, content }] };
  }

  if (kind === "chatgpt") {
    return { role: "tool", tool: "media_gen", result: JSON.stringify({ data: images }) };
  }

  const text = `Generated image${images.length > 1 ? "s" : ""}: ${JSON.stringify(images)}`;
  return { role: "tool", tool_call_id: callId, content: text };
}

/**
 * Resolve which image provider/model to run the generation against.
 * Order: tool args.model → settings.mediaGenModel → env MEDIA_GEN_MODEL →
 * first active image provider with an image-kind model.
 */
export async function resolveMediaGenModel(args, settings = {}) {
  const candidates = [];
  if (typeof args?.model === "string" && args.model) candidates.push(args.model);
  if (typeof settings.mediaGenModel === "string" && settings.mediaGenModel) candidates.push(settings.mediaGenModel);
  if (typeof process?.env?.MEDIA_GEN_MODEL === "string" && process.env.MEDIA_GEN_MODEL) candidates.push(process.env.MEDIA_GEN_MODEL);

  for (const modelStr of candidates) {
    if (!modelStr) continue;
    const info = await getModelInfo(modelStr);
    if (info?.provider) return { modelStr, provider: info.provider, model: info.model };
  }

  for (const providerId of IMAGE_PROVIDER_CANDIDATES) {
    const credentials = await getProviderCredentials(providerId);
    if (!credentials || credentials.allRateLimited) continue;
    const imageModel = firstImageModel(providerId);
    if (!imageModel) continue;
    return { modelStr: `${providerId}/${imageModel.id}`, provider: providerId, model: imageModel.id };
  }
  return null;
}

/**
 * Execute a single media_gen call through the image-generation pipeline,
 * replicating the account-fallback loop used by /v1/images/generations.
 */
export async function executeMediaGenCall({ args, settings, log }) {
  const imageBody = mediaGenArgsToImageBody(args);
  if (!imageBody.prompt) {
    return { ok: false, error: "media_gen requires a prompt" };
  }

  const resolved = await resolveMediaGenModel(args, settings);
  if (!resolved) {
    return {
      ok: false,
      error: 'No image model available. Pass "model" in the media_gen args, set the mediaGenModel setting, or enable an image provider connection.',
    };
  }

  const { provider, model } = resolved;

  if (NO_AUTH_PROVIDERS.has(provider)) {
    const result = await handleImageGenerationCore({
      body: imageBody,
      modelInfo: { provider, model },
      credentials: null,
    });
    if (result.success) {
      const data = await result.response.json().catch(() => null);
      return { ok: true, data };
    }
    return { ok: false, error: result.error || "Image generation failed" };
  }

  const excludeConnectionIds = new Set();
  let lastError = null;

  while (true) {
    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model);
    if (!credentials || credentials.allRateLimited) {
      const msg = credentials?.lastError || lastError || `No active credentials for provider: ${provider}`;
      return { ok: false, error: msg, status: HTTP_STATUS.SERVICE_UNAVAILABLE };
    }

    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);

    const result = await handleImageGenerationCore({
      body: imageBody,
      modelInfo: { provider, model },
      credentials: refreshedCredentials,
      onCredentialsRefreshed: async (newCreds) => {
        await updateProviderCredentials(credentials.connectionId, {
          accessToken: newCreds.accessToken,
          refreshToken: newCreds.refreshToken,
          providerSpecificData: newCreds.providerSpecificData,
          testStatus: "active",
        });
      },
      onRequestSuccess: async () => {
        await clearAccountError(credentials.connectionId, credentials, model);
      },
    });

    if (result.success) {
      const data = await result.response.json().catch(() => null);
      return { ok: true, data };
    }

    const { shouldFallback } = await markAccountUnavailable(
      credentials.connectionId,
      result.status,
      result.error,
      provider,
      model
    );
    if (shouldFallback) {
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      continue;
    }
    return { ok: false, error: result.error || "Image generation failed", status: result.status };
  }
}

/**
 * Scan a chat request for pending media_gen tool calls, execute them, and
 * inject the tool-result messages. Returns a new body (or the same one when
 * there is nothing to execute). Fail-open: any execution error becomes an
 * error tool result instead of failing the whole request.
 */
export async function maybeExecuteMediaGenTool({ body, apiKey, settings, log }) {
  if (!Array.isArray(body?.messages)) return body;
  const calls = extractPendingMediaGenCalls(body.messages);
  if (calls.length === 0) return body;

  const messages = [...body.messages];
  // Process in reverse so earlier message indices stay valid after splicing.
  for (let c = calls.length - 1; c >= 0; c--) {
    const call = calls[c];
    let resultKind = call.kind;

    if (call.kind === "chatgpt") {
      // Normalize the ChatGPT-internal assistant message (tool/args_preview) into
      // a standard OpenAI tool_calls pair so upstreams accept the tool result.
      const assistantMsg = messages[call.messageIndex];
      const normalized = { ...assistantMsg };
      delete normalized.tool;
      delete normalized.args_preview;
      normalized.tool_calls = [{
        id: call.callId,
        type: "function",
        function: { name: "media_gen", arguments: JSON.stringify(call.args) },
      }];
      messages[call.messageIndex] = normalized;
      resultKind = "openai";
    } else if (call.kind === "claude" && Array.isArray(messages[call.messageIndex]?.content)) {
      // Ensure the tool_use block carries the id the injected result references.
      messages[call.messageIndex] = {
        ...messages[call.messageIndex],
        content: messages[call.messageIndex].content.map((block) =>
          block?.type === "tool_use" && block.name === "media_gen" && !block.id
            ? { ...block, id: call.callId }
            : block
        ),
      };
    }

    let toolMsg;
    try {
      const exec = await executeMediaGenCall({ args: call.args, settings, log });
      if (exec.ok && exec.data) {
        const images = formatToolResultImages(exec.data);
        toolMsg = buildMediaGenToolMessage(resultKind, call.callId, images);
        log?.info?.("MEDIAGEN", `executed media_gen (${images.length} image${images.length === 1 ? "" : "s"})`);
      } else {
        toolMsg = buildMediaGenToolMessage(resultKind, call.callId, [], exec.error || "media_gen execution failed");
        log?.warn?.("MEDIAGEN", `media_gen execution failed: ${exec.error || "unknown error"}`);
      }
    } catch (e) {
      toolMsg = buildMediaGenToolMessage(resultKind, call.callId, [], e.message || "media_gen execution failed");
      log?.warn?.("MEDIAGEN", `media_gen execution threw: ${e.message}`);
    }
    messages.splice(call.messageIndex + 1, 0, toolMsg);
  }

  return { ...body, messages };
}
