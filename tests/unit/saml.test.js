import { describe, it, expect } from "vitest";
import {
  formatX509Certificate,
  isSamlConfigured,
  isSamlLoginEnabled,
  getSamlBaseUrl,
  generateSamlMetadata,
  pickSamlEmail,
  pickSamlDisplayName,
  validateSamlResponse,
} from "../../src/lib/auth/saml.js";
import { mergeWithDefaults } from "../../src/lib/db/repos/settingsRepo.js";

describe("SAML 2.0 Auth Engine Utilities", () => {
  describe("formatX509Certificate", () => {
    it("formats raw Base64 string into standard 64-column PEM block", () => {
      const rawBase64 = "MIIC1234567890123456789012345678901234567890123456789012345678901234567890";
      const formatted = formatX509Certificate(rawBase64);
      expect(formatted).toContain("-----BEGIN CERTIFICATE-----");
      expect(formatted).toContain("-----END CERTIFICATE-----");
      expect(formatted).toContain("MIIC123456789012345678901234567890123456789012345678901234567890");
      expect(formatted).toContain("\n1234567890\n");
    });

    it("cleans existing PEM header/footer and extra whitespace", () => {
      const rawPem = `
        -----BEGIN CERTIFICATE-----
        MIIC123456789012345678901234567890123456789012345678901234567890
        1234567890
        -----END CERTIFICATE-----
      `;
      const formatted = formatX509Certificate(rawPem);
      expect(formatted).toContain("-----BEGIN CERTIFICATE-----");
      expect(formatted.match(/BEGIN CERTIFICATE/g)?.length).toBe(1);
    });

    it("returns empty string for null, undefined, or invalid inputs", () => {
      expect(formatX509Certificate(null)).toBe("");
      expect(formatX509Certificate(undefined)).toBe("");
      expect(formatX509Certificate("   ")).toBe("");
    });
  });

  describe("isSamlConfigured", () => {
    it("returns true when entryPoint and cert are non-empty", () => {
      expect(
        isSamlConfigured({
          samlEntryPoint: "https://idp.example.com/sso",
          samlCert: "dummy-cert",
        })
      ).toBe(true);
    });

    it("returns false if entryPoint or cert is missing", () => {
      expect(isSamlConfigured({ samlEntryPoint: "https://idp.example.com/sso" })).toBe(false);
      expect(isSamlConfigured({ samlCert: "dummy-cert" })).toBe(false);
      expect(isSamlConfigured({})).toBe(false);
    });
  });

  describe("isSamlLoginEnabled", () => {
    const configured = {
      samlEntryPoint: "https://idp.example.com/sso",
      samlCert: "dummy-cert",
    };

    it("requires SAML to be configured and selected by an active auth mode", () => {
      expect(isSamlLoginEnabled({ ...configured, authMode: "sso", ssoType: "saml" })).toBe(true);
      expect(isSamlLoginEnabled({ ...configured, authMode: "both", ssoType: "saml" })).toBe(true);
      expect(isSamlLoginEnabled({ ...configured, authMode: "saml", ssoType: "oidc" })).toBe(true);
      expect(isSamlLoginEnabled({ ...configured, authMode: "password", ssoType: "saml" })).toBe(false);
      expect(isSamlLoginEnabled({ ...configured, authMode: "sso", ssoType: "oidc" })).toBe(false);
      expect(isSamlLoginEnabled({ authMode: "saml" })).toBe(false);
    });
  });

  describe("getSamlBaseUrl", () => {
    it("ignores untrusted forwarding headers", () => {
      const request = new Request("http://localhost:20128/api/auth/saml/start", {
        headers: {
          "x-forwarded-host": "attacker.example",
          "x-forwarded-proto": "https",
        },
      });
      expect(getSamlBaseUrl(request, {})).toBe("http://localhost:20128");
    });

    it("accepts forwarding headers carrying trusted peer proof", () => {
      const oldToken = process.env.NINEROUTER_PEER_TOKEN;
      process.env.NINEROUTER_PEER_TOKEN = "test-peer-token";
      try {
        const request = new Request("http://localhost:20128/api/auth/saml/start", {
          headers: {
            "x-9r-peer-token": "test-peer-token",
            "x-9r-via-proxy": "1",
            "x-forwarded-host": "router.example",
            "x-forwarded-proto": "https",
          },
        });
        expect(getSamlBaseUrl(request, {})).toBe("https://router.example");
      } finally {
        if (oldToken === undefined) delete process.env.NINEROUTER_PEER_TOKEN;
        else process.env.NINEROUTER_PEER_TOKEN = oldToken;
      }
    });
  });

  describe("generateSamlMetadata", () => {
    it("generates valid SP XML metadata with Entity ID and ACS binding", () => {
      const settings = {
        samlEntryPoint: "https://idp.example.com/sso",
        samlIssuer: "urn:router2k:sp",
        samlCert: "MIIC123456789012345678901234567890123456789012345678901234567890",
      };
      const xml = generateSamlMetadata("https://localhost:20127", settings);
      expect(xml).toContain('entityID="urn:router2k:sp"');
      expect(xml).toContain('Location="https://localhost:20127/api/auth/saml/acs"');
      expect(xml).toContain('WantAssertionsSigned="true"');
    });
  });

  describe("InResponseTo Replay Validation", () => {
    it("throws error when request state is missing", async () => {
      const settings = { samlCert: "dummy-cert" };
      const rawXml = Buffer.from('<Response InResponseTo="req-123"></Response>').toString("base64");
      await expect(
        validateSamlResponse(null, { SAMLResponse: rawXml }, "", settings)
      ).rejects.toThrow(/request state/);
    });

    it("throws error when expectedRequestId is supplied but InResponseTo is missing", async () => {
      const settings = { samlCert: "dummy-cert" };
      const rawXml = Buffer.from('<Response ID="123"></Response>').toString("base64");
      await expect(
        validateSamlResponse(null, { SAMLResponse: rawXml }, "req-123", settings)
      ).rejects.toThrow(/InResponseTo mismatch/);
    });

    it("throws error when expectedRequestId is supplied but InResponseTo does not match", async () => {
      const settings = { samlCert: "dummy-cert" };
      const rawXml = Buffer.from('<Response InResponseTo="wrong-id"></Response>').toString("base64");
      await expect(
        validateSamlResponse(null, { SAMLResponse: rawXml }, "req-123", settings)
      ).rejects.toThrow(/InResponseTo mismatch/);
    });

    it("does not accept an assertion-level InResponseTo in place of the response attribute", async () => {
      const settings = { samlCert: "dummy-cert" };
      const rawXml = Buffer.from(
        '<Response><Assertion><SubjectConfirmationData InResponseTo="req-123" /></Assertion></Response>'
      ).toString("base64");
      await expect(
        validateSamlResponse(null, { SAMLResponse: rawXml }, "req-123", settings)
      ).rejects.toThrow(/InResponseTo mismatch/);
    });

    it("throws error if samlCert is not configured", async () => {
      const rawXml = Buffer.from('<Response ID="123"></Response>').toString("base64");
      await expect(
        validateSamlResponse(null, { SAMLResponse: rawXml }, "req-123", {})
      ).rejects.toThrow(/Certificate/);
    });
  });

  describe("Claims Extraction", () => {
    const mockProfile = {
      email: "user@example.com",
      displayName: "Jane Doe",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": ["custom@example.com"],
      customEmail: "custom-email@example.com",
      customName: "Custom User",
    };

    it("pickSamlEmail extracts custom attribute or common claims", () => {
      expect(pickSamlEmail(mockProfile, {})).toBe("user@example.com");
      expect(
        pickSamlEmail(mockProfile, { samlAttributeEmail: "customEmail" })
      ).toBe("custom-email@example.com");
      expect(
        pickSamlEmail(
          { "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": ["custom@example.com"] },
          {}
        )
      ).toBe("custom@example.com");
    });

    it("pickSamlDisplayName extracts custom attribute, common names, or falls back to email", () => {
      expect(pickSamlDisplayName(mockProfile, {})).toBe("Jane Doe");
      expect(
        pickSamlDisplayName(mockProfile, { samlAttributeName: "customName" })
      ).toBe("Custom User");
      expect(
        pickSamlDisplayName({ email: "user@example.com" }, {})
      ).toBe("user@example.com");
      expect(
        pickSamlDisplayName({ givenName: "Alice", surname: "Smith" }, {})
      ).toBe("Alice Smith");
    });
  });

  describe("Settings Repository Defaults", () => {
    it("mergeWithDefaults safely populates SAML defaults for existing installations", () => {
      const merged = mergeWithDefaults({ authMode: "password" });
      expect(merged.ssoType).toBe("oidc");
      expect(merged.samlIssuer).toBe("urn:router2k:sp");
      expect(merged.samlLoginLabel).toBe("Sign in with SAML SSO");
      expect(merged.samlAttributeEmail).toBe("email");
      expect(merged.samlAttributeName).toBe("name");
    });
  });
});
