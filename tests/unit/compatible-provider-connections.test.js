import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;

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

async function setupTestContext(nodeData) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-compatible-provider-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();

  const { POST } = await import("@/app/api/providers/route.js");
  const {
    createProviderNode,
    getProviderConnections,
  } = await import("@/models/index.js");

  const node = await createProviderNode(nodeData);

  return {
    node,
    POST,
    getProviderConnections,
    cleanup() {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "EPERM") throw error;
      }
    },
  };
}

async function setupNodeCreationContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-compatible-node-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();

  const { POST } = await import("@/app/api/provider-nodes/route.js");
  const { getProviderConnections } = await import("@/models/index.js");

  return {
    POST,
    getProviderConnections,
    cleanup() {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "EPERM") throw error;
      }
    },
  };
}

function makeRequest(provider, name = "Test Connection") {
  return new Request("https://9router.local/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      apiKey: "test-key",
      name,
      defaultModel: "test-model",
    }),
  });
}

function expectCompatibleConnection(connection, node, { apiType } = {}) {
  expect(connection.provider).toBe(node.id);
  expect(connection.authType).toBe("apikey");
  expect(connection.defaultModel).toBe("test-model");
  expect(connection.providerSpecificData).toMatchObject({
    prefix: node.prefix,
    baseUrl: node.baseUrl,
    nodeName: node.name,
  });

  if (apiType !== undefined) {
    expect(connection.providerSpecificData.apiType).toBe(apiType);
  }
}

describe("compatible provider connections API", () => {
  let cleanup = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cleanup();
    cleanup = () => {};
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
  });

  it("creates one API-key connection for an OpenAI-compatible node", async () => {
    const ctx = await setupTestContext({
      id: "openai-compatible-test",
      type: "openai-compatible",
      name: "OpenAI Compatible Test Node",
      prefix: "oct",
      apiType: "chat",
      baseUrl: "https://openai-compatible.test/v1",
    });
    cleanup = ctx.cleanup;

    const response = await ctx.POST(makeRequest(ctx.node.id));
    const body = await response.json();
    const connection = body.connection;
    const storedConnections = await ctx.getProviderConnections({ provider: ctx.node.id });

    expect(response.status).toBe(201);
    expect(storedConnections).toHaveLength(1);
    expectCompatibleConnection(connection, ctx.node, { apiType: "chat" });
    expect(storedConnections[0]).toMatchObject({
      provider: ctx.node.id,
      authType: "apikey",
      defaultModel: "test-model",
      providerSpecificData: {
        prefix: ctx.node.prefix,
        apiType: "chat",
        baseUrl: ctx.node.baseUrl,
        nodeName: ctx.node.name,
      },
    });
  });

  it("creates one API-key connection for an Anthropic-compatible node", async () => {
    const ctx = await setupTestContext({
      id: "anthropic-compatible-test",
      type: "anthropic-compatible",
      name: "Anthropic Compatible Test Node",
      prefix: "act",
      baseUrl: "https://anthropic-compatible.test/v1",
    });
    cleanup = ctx.cleanup;

    const response = await ctx.POST(makeRequest(ctx.node.id));
    const body = await response.json();
    const connection = body.connection;
    const storedConnections = await ctx.getProviderConnections({ provider: ctx.node.id });

    expect(response.status).toBe(201);
    expect(storedConnections).toHaveLength(1);
    expectCompatibleConnection(connection, ctx.node);
    expect(storedConnections[0]).toMatchObject({
      provider: ctx.node.id,
      authType: "apikey",
      defaultModel: "test-model",
      providerSpecificData: {
        prefix: ctx.node.prefix,
        baseUrl: ctx.node.baseUrl,
        nodeName: ctx.node.name,
      },
    });
  });

  it("allows multiple connections on the same compatible node", async () => {
    const ctx = await setupTestContext({
      id: "openai-compatible-multiple-test",
      type: "openai-compatible",
      name: "Multiple Connections Node",
      prefix: "mul",
      apiType: "chat",
      baseUrl: "https://multiple-connections.test/v1",
    });
    cleanup = ctx.cleanup;

    const firstResponse = await ctx.POST(makeRequest(ctx.node.id, "Key A"));
    const secondResponse = await ctx.POST(makeRequest(ctx.node.id, "Key B"));
    const storedConnections = await ctx.getProviderConnections({ provider: ctx.node.id });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(storedConnections).toHaveLength(2);
    expectCompatibleConnection(storedConnections[0], ctx.node, { apiType: "chat" });
    expectCompatibleConnection(storedConnections[1], ctx.node, { apiType: "chat" });
  });
  it("stores the compatible check key in the new node's key pool", async () => {
    const ctx = await setupNodeCreationContext();
    cleanup = ctx.cleanup;

    const response = await ctx.POST(new Request("https://9router.local/api/provider-nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Checked Compatible",
        prefix: "checked",
        apiType: "chat",
        baseUrl: "https://checked-compatible.test/v1",
        type: "openai-compatible",
        apiKey: "checked-secret-key",
        testStatus: "active",
      }),
    }));
    const body = await response.json();
    const storedConnections = await ctx.getProviderConnections({ provider: body.node.id });

    expect(response.status).toBe(201);
    expect(body.connection).toMatchObject({
      provider: body.node.id,
      authType: "apikey",
      name: "Checked Compatible API Key",
      testStatus: "active",
    });
    expect(body.connection).not.toHaveProperty("apiKey");
    expect(storedConnections).toHaveLength(1);
    expect(storedConnections[0]).toMatchObject({
      provider: body.node.id,
      apiKey: "checked-secret-key",
      providerSpecificData: {
        prefix: "checked",
        apiType: "chat",
        baseUrl: "https://checked-compatible.test/v1",
        nodeName: "Checked Compatible",
      },
    });
    expect(storedConnections[0].defaultModel).toBeUndefined();
  });

  it("creates a compatible key-pool connection without a default model", async () => {
    const ctx = await setupTestContext({
      id: "openai-compatible-no-default",
      type: "openai-compatible",
      name: "No Default Model Node",
      prefix: "nodefault",
      apiType: "chat",
      baseUrl: "https://no-default.test/v1",
    });
    cleanup = ctx.cleanup;

    const response = await ctx.POST(new Request("https://9router.local/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: ctx.node.id,
        apiKey: "test-key",
        name: "No Default",
      }),
    }));
    const storedConnections = await ctx.getProviderConnections({ provider: ctx.node.id });

    expect(response.status).toBe(201);
    expect(storedConnections).toHaveLength(1);
    expect(storedConnections[0].defaultModel).toBeUndefined();
  });
});
