import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  json: vi.fn((body, init = {}) => ({ body, status: init.status || 200 })),
  getDashboardAccount: vi.fn(),
  getApiKeys: vi.fn(),
  getApiKeyById: vi.fn(),
  getUsageStats: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: mocks.json },
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAccount: mocks.getDashboardAccount,
}));

vi.mock("@/lib/localDb", () => ({
  getApiKeys: mocks.getApiKeys,
  getApiKeyById: mocks.getApiKeyById,
}));

vi.mock("@/lib/usageDb", () => ({
  getUsageStats: mocks.getUsageStats,
}));

const { GET } = await import("../../src/app/api/usage/stats/route.js");

function request(query = "") {
  return { url: `http://localhost/api/usage/stats${query}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDashboardAccount.mockResolvedValue({ id: "admin-id", role: "admin" });
  mocks.getApiKeys.mockResolvedValue([{ key: "owned-key" }]);
  mocks.getUsageStats.mockResolvedValue({ totalRequests: 0 });
});

describe("usage statistics scope", () => {
  it("keeps the default admin usage view scoped to owned API keys", async () => {
    await GET(request("?period=all"));

    expect(mocks.getApiKeys).toHaveBeenCalledWith("admin-id");
    expect(mocks.getUsageStats).toHaveBeenCalledWith("all", {
      apiKeyFilter: ["owned-key"],
      forceHistory: false,
    });
  });

  it("allows an admin operational view to request system-wide usage", async () => {
    await GET(request("?period=7d&scope=system"));

    expect(mocks.getApiKeys).not.toHaveBeenCalled();
    expect(mocks.getUsageStats).toHaveBeenCalledWith("7d", {
      apiKeyFilter: null,
      forceHistory: true,
    });
  });

  it("does not expose system-wide usage to account users", async () => {
    mocks.getDashboardAccount.mockResolvedValue({ id: "user-id", role: "user" });

    await GET(request("?period=7d&scope=system"));

    expect(mocks.getUsageStats).toHaveBeenCalledWith("7d", {
      apiKeyFilter: "__none__",
      forceHistory: true,
    });
  });
});
