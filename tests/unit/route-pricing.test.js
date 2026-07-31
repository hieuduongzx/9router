// Dashboard / Models stores a published route's price under {virtualProvider, routeName},
// but billing only ever saw the upstream {connectionId, upstreamModel} — so the price an
// administrator set for a route was never applied and traffic fell back to the built-in
// list rate. Cost calculation must prefer the route's price when the request came in
// through that route, while direct provider/model traffic keeps its old behaviour.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;

const UPSTREAM_PROVIDER = "openai-compatible-chat-d7f5b5c2";
const ROUTE_NAME = "claude-opus-5";
const ROUTE_OWNER = "Anthropic";
const TOKENS = { prompt_tokens: 1_000_000, completion_tokens: 100_000 };

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-route-pricing-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  const { getAdapter } = await import("@/lib/db/driver.js");
  adapter = await getAdapter();

  await db.createCombo({ name: ROUTE_NAME, models: [`a6api/${ROUTE_NAME}`], modelProvider: ROUTE_OWNER });
});

afterAll(() => {
  adapter?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("published route pricing", () => {
  it("falls back to the built-in rate when no override exists", async () => {
    const cost = await db.getPricing().then(() => null) ?? null;
    expect(cost).toBeNull();

    const { calculateRequestCost } = await import("@/lib/db/repos/usageRepo.js");
    const listPrice = await calculateRequestCost(UPSTREAM_PROVIDER, ROUTE_NAME, TOKENS, ROUTE_NAME);
    // claude-opus-5 has no canonical entry; it pattern-matches Anthropic list $5/$25.
    expect(listPrice).toBeCloseTo(1_000_000 * 5 / 1e6 + 100_000 * 25 / 1e6, 6);
  });

  it("uses the route's own price once an administrator sets one", async () => {
    await db.updatePricing({ [ROUTE_OWNER.toLowerCase()]: { [ROUTE_NAME]: { input: 1, output: 2 } } });

    const { calculateRequestCost } = await import("@/lib/db/repos/usageRepo.js");
    const routed = await calculateRequestCost(UPSTREAM_PROVIDER, ROUTE_NAME, TOKENS, ROUTE_NAME);
    expect(routed).toBeCloseTo(1_000_000 * 1 / 1e6 + 100_000 * 2 / 1e6, 6);

    // Same upstream model requested directly (no route) must NOT pick up the route price.
    const direct = await calculateRequestCost(UPSTREAM_PROVIDER, ROUTE_NAME, TOKENS, null);
    expect(direct).toBeCloseTo(1_000_000 * 5 / 1e6 + 100_000 * 25 / 1e6, 6);
  });

  it("keeps honouring an upstream-keyed override for direct traffic", async () => {
    await db.updatePricing({ "fal-ai": { "google/gemini-3.6-flash": { input: 1.5, output: 7.5 } } });

    const { calculateRequestCost } = await import("@/lib/db/repos/usageRepo.js");
    const cost = await calculateRequestCost("fal-ai", "google/gemini-3.6-flash", { prompt_tokens: 2885, completion_tokens: 2897 });
    expect(cost).toBeCloseTo(2885 * 1.5 / 1e6 + 2897 * 7.5 / 1e6, 8);
  });

  it("saveRequestUsage persists the route price for a routed request", async () => {
    await db.saveRequestUsage({
      provider: UPSTREAM_PROVIDER,
      model: ROUTE_NAME,
      publicModel: ROUTE_NAME,
      tokens: TOKENS,
      timestamp: new Date().toISOString(),
    });

    const row = adapter.get("SELECT cost FROM usageHistory ORDER BY id DESC LIMIT 1");
    expect(row.cost).toBeCloseTo(1_000_000 * 1 / 1e6 + 100_000 * 2 / 1e6, 6);
  });
});
