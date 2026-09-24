import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getSettings: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getSettings: mocks.getSettings,
  updateProviderConnection: mocks.updateProviderConnection,
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: vi.fn(),
  pickProxyPoolId: vi.fn(),
}));
vi.mock("@/shared/constants/providers.js", () => ({
  FREE_PROVIDERS: {},
  resolveProviderId: (provider) => provider,
}));
vi.mock("@/sse/utils/logger.js", () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn() }));

const { markAccountUnavailable } = await import("@/sse/services/auth.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettings.mockResolvedValue({ providerStrategies: { codex: { autoSwitchOnQuota: true } } });
  mocks.getProviderConnections.mockResolvedValue([
    { id: "codex-a", provider: "codex", priority: 1, isActive: true },
    { id: "codex-b", provider: "codex", priority: 2, isActive: true },
    { id: "codex-c", provider: "codex", priority: 3, isActive: true },
  ]);
  mocks.updateProviderConnection.mockResolvedValue({});
});

describe("quota auto-switch", () => {
  it("moves a quota-limited account behind provider peers when enabled", async () => {
    await markAccountUnavailable("codex-a", 429, "usage_limit_reached", "codex", "gpt-5-codex");

    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("codex-a", expect.objectContaining({
      priority: 4,
      "modelLock_gpt-5-codex": expect.any(String),
    }));
  });

  it("does not change account order when disabled", async () => {
    mocks.getSettings.mockResolvedValue({ providerStrategies: { codex: { autoSwitchOnQuota: false } } });

    await markAccountUnavailable("codex-a", 429, "usage_limit_reached", "codex", "gpt-5-codex");

    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("codex-a", expect.not.objectContaining({ priority: expect.any(Number) }));
  });

  it("does not reorder accounts for non-quota failures", async () => {
    await markAccountUnavailable("codex-a", 503, "upstream unavailable", "codex", "gpt-5-codex");

    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("codex-a", expect.not.objectContaining({ priority: expect.any(Number) }));
  });
});
