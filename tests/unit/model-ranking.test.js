import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Public model-ranking feature: repo aggregation + unauthenticated route.
 *
 * The repo test drives getModelRanking through a fake SQLite adapter —
 * getModelRanking only ever calls adapter.all(), so a SQL-sniffing stub is
 * enough to exercise both data sources (usageDaily rollups + usageHistory).
 */

const { fakeAdapter, rowsByTable, getAdapterMock } = vi.hoisted(() => {
  const rowsByTable = {
    usageHistory: [],
    usageDaily: [],
    providerNodes: [],
  };

  const adapter = {
    all(sql, params = []) {
      if (/FROM usageDaily/i.test(sql)) {
        const cutoffKey = sql.includes("dateKey >= ?") ? params[0] : null;
        return rowsByTable.usageDaily.filter((r) => !cutoffKey || r.dateKey >= cutoffKey);
      }
      if (/FROM usageHistory/i.test(sql)) {
        let rows = rowsByTable.usageHistory;
        if (sql.includes("timestamp >= ?")) {
          const cutoffIso = params[0];
          rows = rows.filter((r) => r.timestamp >= cutoffIso);
        }
        return rows;
      }
      if (/FROM providerNodes/i.test(sql)) return rowsByTable.providerNodes;
      return [];
    },
    get() { return null; },
    run() {},
  };

  return {
    fakeAdapter: adapter,
    rowsByTable,
    getAdapterMock: vi.fn(async () => adapter),
  };
});

vi.mock("../../src/lib/db/driver.js", () => ({
  getAdapter: getAdapterMock,
}));

const jsonSpy = vi.fn((body, init = {}) => ({ body, status: init.status || 200 }));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonSpy },
}));

const { getModelRanking } = await import("../../src/lib/db/repos/usageRepo.js");
const { GET: rankingGET } = await import("../../src/app/api/ranking/models/route.js");

/** Local calendar dateKey N days before today (matches loadDaysInRange semantics). */
function dateKeyDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function dayRow(dateKey, byModel) {
  return {
    dateKey,
    data: JSON.stringify({
      requests: Object.values(byModel).reduce((s, m) => s + (m.requests || 0), 0),
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      cost: 0,
      byProvider: {},
      byModel,
      byAccount: {},
      byApiKey: {},
      byEndpoint: {},
    }),
  };
}

function histRow({ ts, model, provider, promptTokens = 10, completionTokens = 5 }) {
  return {
    timestamp: ts,
    provider,
    model,
    connectionId: "conn-1",
    apiKey: null,
    endpoint: "/v1/chat/completions",
    promptTokens,
    completionTokens,
    cost: 0.01,
    status: "ok",
    tokens: JSON.stringify({
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    }),
  };
}

function request(query = "") {
  return { url: `http://localhost/api/ranking/models${query}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  rowsByTable.usageHistory = [];
  rowsByTable.usageDaily = [];
  rowsByTable.providerNodes = [{ id: "openai", name: "OpenAI" }];
});

describe("getModelRanking (repo)", () => {
  it("aggregates daily rollups for whole-day windows and ranks by requests", async () => {
    rowsByTable.usageDaily = [
      dayRow(dateKeyDaysAgo(2), {
        "claude-sonnet-4|anthropic": { rawModel: "claude-sonnet-4", provider: "anthropic", requests: 30, promptTokens: 100, completionTokens: 50 },
        "gpt-5|openai": { rawModel: "gpt-5", provider: "openai", requests: 70, promptTokens: 200, completionTokens: 80 },
      }),
      dayRow(dateKeyDaysAgo(4), {
        "gpt-5|openai": { rawModel: "gpt-5", provider: "openai", requests: 40, promptTokens: 90, completionTokens: 30 },
      }),
      // Outside the 7-day window → excluded
      dayRow(dateKeyDaysAgo(20), {
        "gpt-5|openai": { rawModel: "gpt-5", provider: "openai", requests: 999 },
      }),
    ];

    const ranking = await getModelRanking("7d", {});

    expect(ranking.models).toHaveLength(2);
    expect(ranking.models[0]).toMatchObject({
      rank: 1,
      model: "gpt-5",
      provider: "OpenAI", // display name resolved via providerNodes
      requests: 110,
      totalTokens: 400,
    });
    expect(ranking.models[1].model).toBe("claude-sonnet-4");
    expect(ranking.totalRequests).toBe(140);
    expect(ranking.totalTokens).toBe(550);
    // Cost stays in the repo-level payload; the public route strips it.
    expect(ranking.models[0].cost).toBeDefined();
    expect(ranking.period).toBe("7d");
  });

  it("scans live history for sub-day windows and applies the period cutoff", async () => {
    rowsByTable.usageHistory = [
      histRow({ ts: isoMinutesAgo(5), model: "gpt-5", provider: "openai" }),
      histRow({ ts: isoMinutesAgo(2), model: "gpt-5", provider: "openai" }),
      // Outside the 1h window → must be excluded
      histRow({ ts: isoMinutesAgo(180), model: "gpt-5", provider: "openai" }),
    ];
    // A 1h window never reads rollups even when they exist.
    rowsByTable.usageDaily = [dayRow(dateKeyDaysAgo(0), { "old-model|x": { rawModel: "old-model", provider: "x", requests: 999 } })];

    const ranking = await getModelRanking("1h", {});

    expect(ranking.models).toHaveLength(1);
    expect(ranking.models[0].requests).toBe(2);
    expect(ranking.totalRequests).toBe(2);
  });

  it("supports token-based sorting with stable tie-breaking", async () => {
    rowsByTable.usageHistory = [
      histRow({ ts: isoMinutesAgo(9), model: "b-model", provider: "p", promptTokens: 2000, completionTokens: 0 }),
      histRow({ ts: isoMinutesAgo(8), model: "a-model", provider: "p", promptTokens: 900, completionTokens: 0 }),
      histRow({ ts: isoMinutesAgo(7), model: "a-model", provider: "p", promptTokens: 900, completionTokens: 0 }),
    ];

    const ranking = await getModelRanking("24h", { sort: "tokens" });

    expect(ranking.models.map((m) => m.model)).toEqual(["b-model", "a-model"]);
    expect(ranking.models.map((m) => m.rank)).toEqual([1, 2]);
    expect(ranking.models[1].requests).toBe(2);

    const byRequests = await getModelRanking("24h", { sort: "requests" });
    expect(byRequests.models.map((m) => m.model)).toEqual(["a-model", "b-model"]);
  });

  it("uses history only as a lastUsed overlay for long windows (no double counting)", async () => {
    const recentTs = isoMinutesAgo(1);
    rowsByTable.usageDaily = [
      dayRow(dateKeyDaysAgo(3), { "gpt-5|openai": { rawModel: "gpt-5", provider: "openai", requests: 10 } }),
    ];
    // The same 10 requests (plus one newer one) also sit in usageHistory —
    // every insert lands in both stores, so counting both would double them.
    rowsByTable.usageHistory = [
      histRow({ ts: isoMinutesAgo(60 * 24 * 3), model: "gpt-5", provider: "openai" }),
      histRow({ ts: isoMinutesAgo(60 * 24 * 3), model: "gpt-5", provider: "openai" }),
      histRow({ ts: recentTs, model: "gpt-5", provider: "openai" }),
    ];

    const ranking = await getModelRanking("all", {});
    const gpt5 = ranking.models.find((m) => m.model === "gpt-5");

    // Counts come from the rollup alone; lastUsed upgrades to the precise stamp.
    expect(gpt5.requests).toBe(10);
    expect(gpt5.lastUsed).toBe(recentTs);
    expect(ranking.totalRequests).toBe(10);
  });
});

describe("GET /api/ranking/models (public route)", () => {
  it("serves rankings without any auth context and strips cost", async () => {
    rowsByTable.usageHistory = [histRow({ ts: isoMinutesAgo(3), model: "gpt-5", provider: "openai" })];

    const response = await rankingGET(request("?period=24h&limit=10"));

    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.period).toBe("24h");
    expect(body.models).toHaveLength(1);
    expect(body.models[0]).not.toHaveProperty("cost");
    expect(body.models[0].rank).toBe(1);
    expect(Object.keys(body.models[0]).sort()).toEqual(
      ["cachedTokens", "completionTokens", "lastUsed", "model", "promptTokens", "provider", "rank", "requests", "totalTokens"],
    );
  });

  it("rejects invalid periods and invalid sorts", async () => {
    expect((await rankingGET(request("?period=forever"))).status).toBe(400);
    expect((await rankingGET(request("?sort=votes"))).status).toBe(400);
  });

  it("caps the limit at MAX_LIMIT=100", async () => {
    // 7d reads usageDaily rollups — seed the leaderboard there, not in history.
    const byModel = {};
    for (let i = 0; i < 150; i++) {
      byModel[`m-${i}|p`] = { rawModel: `m-${i}`, provider: "p", requests: 150 - i };
    }
    rowsByTable.usageDaily = [dayRow(dateKeyDaysAgo(1), byModel)];

    const response = await rankingGET(request("?limit=9999"));
    expect(response.status).toBe(200);
    expect(response.body.models.length).toBe(100);
    expect(response.body.models[0].model).toBe("m-0");
  });

  it("returns a generic 500 instead of leaking internals when the DB fails", async () => {
    getAdapterMock.mockRejectedValueOnce(new Error("boom"));

    const response = await rankingGET(request());
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to fetch model ranking");
  });
});
