import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn(),
  getCustomModels: vi.fn(),
  getModelAliases: vi.fn(),
  getPublishedModels: vi.fn(),
}));

vi.mock("@/lib/localDb", () => db);
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: vi.fn(async () => ({})) }));

const { GET } = await import("../../src/app/api/v1/models/route.js");

describe("GET /v1/models published catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getCombos.mockResolvedValue([
      {
        id: "published-combo",
        name: "claude-premium",
        kind: "llm",
        modelProvider: "Anthropic",
        models: ["cc/claude-sonnet-4-5", "cx/gpt-5.6-sol"],
      },
      {
        id: "private-combo",
        name: "internal-fallback",
        kind: "llm",
        modelProvider: "OpenAI",
        models: ["cx/gpt-5.6-sol"],
      },
    ]);
    db.getPublishedModels.mockResolvedValue([
      { comboId: "published-combo", createdAt: "2026-07-26T00:00:00.000Z" },
    ]);
  });

  it("returns only dashboard-published combos with the assigned owner", async () => {
    const response = await GET(new Request("http://localhost/v1/models"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      object: "list",
      data: [
        expect.objectContaining({
          id: "claude-premium",
          object: "model",
          owned_by: "Anthropic",
        }),
      ],
    });
    expect(db.getProviderConnections).not.toHaveBeenCalled();
    expect(db.getCustomModels).not.toHaveBeenCalled();
    expect(db.getModelAliases).not.toHaveBeenCalled();
  });
});
