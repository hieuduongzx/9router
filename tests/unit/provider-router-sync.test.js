import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let syncRouterMembersForProvider;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-provider-router-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  ({ syncRouterMembersForProvider } = await import("@/lib/providerRouterSync.js"));
});

afterAll(async () => {
  const { getAdapter } = await import("@/lib/db/driver.js");
  (await getAdapter())?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("syncRouterMembersForProvider", () => {
  it("disables a provider's router members when every connection is off, then restores only those", async () => {
    const combo = await db.createCombo({
      name: "route-codex",
      models: ["cx/gpt-5", "openai/gpt-4o"],
      disabledMembers: ["openai/gpt-4o"],
    });
    const connection = await db.createProviderConnection({
      provider: "codex",
      authType: "oauth",
      name: "codex-main",
      isActive: false,
    });

    const disabled = await syncRouterMembersForProvider("codex", false);
    expect(disabled.enabled).toBe(false);
    expect(disabled.updated).toBe(1);
    expect((await db.getComboById(combo.id)).disabledMembers).toEqual(["openai/gpt-4o", "cx/gpt-5"]);

    await db.updateProviderConnection(connection.id, { isActive: true });
    const enabled = await syncRouterMembersForProvider("codex", true);
    expect(enabled.enabled).toBe(true);
    expect((await db.getComboById(combo.id)).disabledMembers).toEqual(["openai/gpt-4o"]);
  });

  it("leaves router members alone when another connection of the same provider is still active", async () => {
    const combo = await db.createCombo({
      name: "route-codex-live",
      models: ["cx/gpt-5-mini"],
    });
    await db.createProviderConnection({
      provider: "codex",
      authType: "apikey",
      name: "codex-key",
      isActive: true,
    });

    const result = await syncRouterMembersForProvider("codex", false);
    expect(result.skipped).toBe(true);
    expect((await db.getComboById(combo.id)).disabledMembers).toEqual([]);
  });

  it("matches a custom node's display prefix, not only its id", async () => {
    const providerId = "openai-compatible-chat-sync";
    await db.createProviderNode({
      id: providerId,
      type: "openai-compatible",
      name: "Mimo",
      prefix: "mimo",
    });
    const combo = await db.createCombo({
      name: "route-mimo",
      models: ["mimo/mimo-v2.5", "openai/gpt-4o"],
    });
    await db.createProviderConnection({
      provider: providerId,
      authType: "apikey",
      name: "mimo-key",
      isActive: false,
    });

    await syncRouterMembersForProvider(providerId, false);
    expect((await db.getComboById(combo.id)).disabledMembers).toEqual(["mimo/mimo-v2.5"]);
  });
});
