import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  nextResponse: Symbol("next"),
  jsonResponse: vi.fn((body, init) => ({
    status: init?.status || 200,
    body,
  })),
  getSettings: vi.fn(),
  validateApiKey: vi.fn(),
  getConsistentMachineId: vi.fn(),
  verifyDashboardAuthToken: vi.fn(),
  getDashboardAccount: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => mocks.nextResponse),
    json: mocks.jsonResponse,
    redirect: vi.fn((url) => ({ status: 307, url })),
  },
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  validateApiKey: mocks.validateApiKey,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: mocks.verifyDashboardAuthToken,
  getDashboardAccount: mocks.getDashboardAccount,
}));

const { proxy, __test__ } = await import("../../src/dashboardGuard.js");

const PEER_TOKEN = "peer-token-fixture";

function request(pathname, headers = {}, token = null, cookieValues = {}) {
  const normalizedHeaders = new Headers(headers);
  return {
    nextUrl: { pathname, searchParams: new URL(`http://localhost${pathname}`).searchParams },
    headers: normalizedHeaders,
    cookies: {
      get: vi.fn((name) => {
        if (name === "auth_token" && token) return { value: token };
        return cookieValues[name] ? { value: cookieValues[name] } : undefined;
      }),
    },
    url: `http://localhost${pathname}`,
  };
}

// A request that actually came through custom-server.js: peer IP stamped from the TCP
// socket and proven by the per-process secret.
function localRequest(pathname, headers = {}) {
  return request(pathname, { "x-9r-peer-token": PEER_TOKEN, "x-9r-real-ip": "127.0.0.1", ...headers });
}

describe("dashboard guard public LLM API access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
    mocks.validateApiKey.mockResolvedValue(false);
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    mocks.verifyDashboardAuthToken.mockResolvedValue(false);
    mocks.getDashboardAccount.mockResolvedValue(null);
  });

  it("rejects loopback public LLM API without API key", async () => {
    const response = await proxy(localRequest("/v1/chat/completions", { host: "localhost:20128" }));
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
    expect(mocks.validateApiKey).not.toHaveBeenCalled();
  });

  it("rejects remote Host-spoof when real peer IP is non-loopback", async () => {
    const response = await proxy(localRequest("/v1/chat/completions", {
      host: "localhost",
      "x-9r-real-ip": "10.204.111.34",
    }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects loopback peer IP without API key", async () => {
    const response = await proxy(localRequest("/v1/chat/completions", {
      host: "localhost:20128",
      "x-9r-real-ip": "127.0.0.1",
    }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
    expect(mocks.validateApiKey).not.toHaveBeenCalled();
  });

  it("rejects remote rewritten public LLM API without API key", async () => {
    const response = await proxy(request("/api/v1/chat/completions", { host: "router.example.com" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects loopback rewritten public LLM API without API key", async () => {
    const response = await proxy(localRequest("/api/v1/chat/completions", { host: "localhost:20128" }));
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects remote beta public LLM API without API key", async () => {
    const response = await proxy(request("/v1beta/models", { host: "router.example.com" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects remote rewritten beta public LLM API without API key", async () => {
    const response = await proxy(request("/api/v1beta/models", { host: "router.example.com" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects remote codex rewrite without API key", async () => {
    const response = await proxy(request("/codex/x", { host: "router.example.com" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("rejects remote /responses rewrite without API key", async () => {
    const response = await proxy(request("/responses", { host: "router.example.com" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Valid API key required");
  });

  it("allows remote /responses rewrite with a valid API key", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/responses", {
      host: "router.example.com",
      authorization: "Bearer sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote codex rewrite with valid API key", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/codex/x", {
      host: "router.example.com",
      authorization: "Bearer sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote public LLM API with valid bearer API key", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/api/v1/chat/completions", {
      host: "router.example.com",
      authorization: "Bearer sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote public LLM API with valid x-api-key", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/v1/web/fetch", {
      host: "router.example.com",
      "x-api-key": "sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote rewritten beta public LLM API with valid API key", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/api/v1beta/models", {
      host: "router.example.com",
      "x-api-key": "sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote beta public LLM API with valid Google API key header", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/v1beta/models", {
      host: "router.example.com",
      "x-goog-api-key": "sk-valid",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });

  it("allows remote beta public LLM API with valid Google key query parameter", async () => {
    mocks.validateApiKey.mockResolvedValue(true);

    const response = await proxy(request("/v1beta/models?key=sk-valid", {
      host: "router.example.com",
    }));

    expect(response).toBe(mocks.nextResponse);
    expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-valid");
  });
});

describe("dashboard guard public product home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
    mocks.validateApiKey.mockResolvedValue(false);
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    mocks.verifyDashboardAuthToken.mockResolvedValue(false);
    mocks.getDashboardAccount.mockResolvedValue(null);
  });

  it("serves the product home without forcing dashboard login", async () => {
    expect(await proxy(request("/"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/landing"))).toBe(mocks.nextResponse);
  });

  it("exposes the model catalog to guests", async () => {
    expect(await proxy(request("/api/catalog/models"))).toBe(mocks.nextResponse);
  });

  it("still requires login for the authenticated dashboard", async () => {
    const response = await proxy(request("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.url.pathname).toBe("/login");
  });
});

describe("dashboard guard local-only access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
    mocks.validateApiKey.mockResolvedValue(false);
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    mocks.verifyDashboardAuthToken.mockResolvedValue(false);
    mocks.getDashboardAccount.mockResolvedValue(null);
  });

  it("rejects local-only route from non-loopback host without CLI token", async () => {
    const response = await proxy(request("/api/mcp/filesystem/sse", {
      host: "router.example.com",
    }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Local only: CLI token required");
  });

  it("rejects local-only route on loopback when requireLogin=true and no JWT", async () => {
    const response = await proxy(localRequest("/api/mcp/filesystem/sse", {
      host: "localhost:20128",
      origin: "http://localhost:20128",
    }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Local only: CLI token required");
  });

  it("keeps control-plane routes admin-only when requireLogin=false", async () => {
    mocks.getSettings.mockResolvedValue({ requireLogin: false });

    const response = await proxy(localRequest("/api/cli-tools/antigravity-mitm", {
      host: "localhost:20128",
      origin: "http://localhost:20128",
    }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Administrator access required");
  });

  it("rejects local-only route from a remote host even when requireLogin=false", async () => {
    mocks.getSettings.mockResolvedValue({ requireLogin: false });

    const response = await proxy(request("/api/cli-tools/antigravity-mitm", {
      host: "router.example.com",
    }));

    expect(response.status).toBe(403);
  });

  it("rejects local-only route when Origin is non-loopback (CSRF block)", async () => {
    mocks.getSettings.mockResolvedValue({ requireLogin: false });

    const response = await proxy(localRequest("/api/cli-tools/antigravity-mitm", {
      host: "localhost:20128",
      origin: "http://evil.example.com",
    }));

    expect(response.status).toBe(403);
  });

  it("allows local-only route with valid CLI token", async () => {
    const response = await proxy(request("/api/mcp/filesystem/sse", {
      host: "router.example.com",
      "x-9r-cli-token": "cli-token",
    }));

    expect(response).toBe(mocks.nextResponse);
  });
});


describe("dashboard guard role boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    mocks.verifyDashboardAuthToken.mockResolvedValue(true);
    mocks.getDashboardAccount.mockResolvedValue({
      id: "user-1",
      role: "user",
      isActive: true,
    });
  });

  it("denies provider APIs to account users", async () => {
    const response = await proxy(request("/api/providers"));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Administrator access required");
  });

  it("allows account-scoped request details but keeps system usage administrator-only", async () => {
    expect(await proxy(request("/api/usage/request-details"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/api/usage/providers"))).toBe(mocks.nextResponse);

    const response = await proxy(request("/api/usage/system"));
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Administrator access required");
  });

  it("allows account-scoped usage and model catalog APIs", async () => {
    expect(await proxy(request("/api/usage/stats?period=7d"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/api/catalog/models"))).toBe(mocks.nextResponse);
  });

  it("keeps connection-level provider usage administrator-only", async () => {
    const response = await proxy(request("/api/usage/connection-1"));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Administrator access required");
  });
  it("redirects users away from administrator pages", async () => {
    const response = await proxy(request("/dashboard/providers"));

    expect(response.status).toBe(307);
    expect(response.url.pathname).toBe("/dashboard");
    const settingsResponse = await proxy(request("/dashboard/settings"));
    expect(settingsResponse.status).toBe(307);
    expect(settingsResponse.url.pathname).toBe("/dashboard");
  });

  it("allows users to open account-safe dashboard pages", async () => {
    expect(await proxy(request("/dashboard/models", {}, "user-token"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/dashboard/account", {}, "user-token"))).toBe(mocks.nextResponse);
  });

  it("allows administrators to use control-plane APIs", async () => {
    mocks.getDashboardAccount.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      isActive: true,
    });

    expect(await proxy(request("/api/providers"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/api/usage/connection-1"))).toBe(mocks.nextResponse);
  });

  // The visible shell has to be the route group. An admin-only page reached
  // under /dashboard would render inside the user rail, which is how the two
  // used to disagree about which mode you were in.
  it("moves an administrator's admin-only dashboard pages into the admin shell", async () => {
    mocks.getDashboardAccount.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      isActive: true,
    });

    const providers = await proxy(request("/dashboard/providers"));
    expect(providers.status).toBe(307);
    expect(providers.url.pathname).toBe("/admin/providers");

    const settings = await proxy(request("/dashboard/settings"));
    expect(settings.status).toBe(307);
    expect(settings.url.pathname).toBe("/admin/settings");

    // Sub-paths carry across; Model Routes is renamed in the admin rail.
    const connection = await proxy(request("/dashboard/providers/anthropic"));
    expect(connection.url.pathname).toBe("/admin/providers/anthropic");

    const routes = await proxy(request("/dashboard/combos"));
    expect(routes.url.pathname).toBe("/admin/router");
  });

  it("keeps account-safe pages under both prefixes for an administrator", async () => {
    mocks.getDashboardAccount.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      isActive: true,
    });

    // These are an administrator's *own* keys and usage — no shell rewrite.
    expect(await proxy(request("/dashboard/usage", {}, "admin-token"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/dashboard/api-keys", {}, "admin-token"))).toBe(mocks.nextResponse);
    expect(await proxy(request("/dashboard/account", {}, "admin-token"))).toBe(mocks.nextResponse);
  });

  it("keeps Activity administrator-only without consulting a separate view mode", async () => {
    mocks.getDashboardAccount.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      isActive: true,
    });

    const adminActivity = await proxy(request("/dashboard/activity"));
    expect(adminActivity.status).toBe(307);
    expect(adminActivity.url.pathname).toBe("/admin/activity");

    mocks.getDashboardAccount.mockResolvedValue({ id: "user-1", role: "user", isActive: true });
    const userActivity = await proxy(request("/dashboard/activity"));
    expect(userActivity.status).toBe(307);
    expect(userActivity.url.pathname).toBe("/dashboard");
  });
});
describe("dashboard guard helpers", () => {
  it("extracts bearer API keys before x-api-key", () => {
    const apiRequest = request("/v1/chat/completions", {
      authorization: "Bearer bearer-key",
      "x-api-key": "header-key",
    });

    expect(__test__.extractApiKey(apiRequest)).toBe("bearer-key");
  });

  it("extracts Google API keys after x-api-key", () => {
    const apiRequest = request("/v1beta/models?key=query-key", {
      "x-api-key": "header-key",
      "x-goog-api-key": "google-key",
    });

    expect(__test__.extractApiKey(apiRequest)).toBe("header-key");
  });
});
