import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
}));

const { getOidcRuntimeConfig } = await import("../../src/lib/auth/oidc.js");

const configured = {
  authMode: "sso",
  ssoType: "oidc",
  oidcIssuerUrl: "https://idp.example.com/",
  oidcClientId: "client-id",
  oidcClientSecret: "client-secret",
};

describe("OIDC runtime configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables OIDC for generic SSO mode when OIDC is selected", async () => {
    mocks.getSettings.mockResolvedValue(configured);

    await expect(getOidcRuntimeConfig()).resolves.toMatchObject({
      issuerUrl: "https://idp.example.com",
      clientId: "client-id",
    });
  });

  it("rejects OIDC runtime access when generic SSO selects another protocol", async () => {
    mocks.getSettings.mockResolvedValue({ ...configured, ssoType: "saml" });

    await expect(getOidcRuntimeConfig()).resolves.toBeNull();
  });
});
