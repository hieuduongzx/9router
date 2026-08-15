import { SAML } from "@node-saml/node-saml";
import { getSettings } from "../db/repos/settingsRepo.js";
import { hasTrustedPeerHeaders } from "./trustedPeer.js";

/**
 * Formats a raw Base64 string or unformatted X.509 certificate into standard PEM format.
 * @param {string} certStr
 * @returns {string}
 */
export function formatX509Certificate(certStr) {
  if (!certStr || typeof certStr !== "string") return "";
  const clean = certStr
    .replace(/-----BEGIN CERTIFICATE-----/gi, "")
    .replace(/-----END CERTIFICATE-----/gi, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");

  if (!clean) return "";

  const lines = clean.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

/**
 * Checks whether SAML configuration has essential parameters (entryPoint & cert).
 * @param {object} settings
 * @returns {boolean}
 */
export function isSamlConfigured(settings) {
  return Boolean(String(settings?.samlEntryPoint || "").trim() && String(settings?.samlCert || "").trim());
}

export function isSamlLoginEnabled(settings) {
  if (!isSamlConfigured(settings)) return false;
  const authMode = String(settings?.authMode || "password").toLowerCase();
  const selectedSso = authMode === "saml"
    ? "saml"
    : authMode === "oidc"
      ? "oidc"
      : String(settings?.ssoType || "oidc").toLowerCase();
  return ["saml", "sso", "both"].includes(authMode) && selectedSso === "saml";
}

/**
 * Fetches settings and returns runtime status + settings.
 * @returns {Promise<{ configured: boolean, settings: object }>}
 */
export async function getSamlRuntimeConfig() {
  const settings = await getSettings();
  return {
    configured: isSamlLoginEnabled(settings),
    settings,
  };
}

/**
 * Creates a configured `@node-saml/node-saml` SAML instance with security defaults.
 * @param {object} settings
 * @param {string} origin
 * @returns {SAML}
 */
const DUMMY_FALLBACK_CERT =
  "-----BEGIN CERTIFICATE-----\nMIIC...DUMMY...\n-----END CERTIFICATE-----";

function trimTrailingSlashes(str) {
  return (str || "").replace(/\/+$/, "");
}

/**
 * Resolves the public Base URL / Origin for SAML requests.
 * Forwarding headers are accepted only when custom-server.js proves the request
 * arrived through its trusted local reverse-proxy path.
 * @param {Request} request
 * @param {object} settings
 * @returns {string}
 */
export function getSamlBaseUrl(request, settings) {
  const configuredBaseUrl =
    (settings?.baseUrl || "").trim() ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";

  if (configuredBaseUrl) {
    try {
      const url = new URL(configuredBaseUrl);
      if (['http:', 'https:'].includes(url.protocol)) return url.origin;
    } catch {}
  }

  if (request?.url) {
    const requestUrl = new URL(request.url);
    if (!['http:', 'https:'].includes(requestUrl.protocol)) throw new Error("SAML request URL must use HTTP or HTTPS");
    const trustedProxy = hasTrustedPeerHeaders(request)
      && request.headers.get("x-9r-via-proxy") === "1";
    if (!trustedProxy) return requestUrl.origin;

    const forwardedProto = request?.headers?.get?.("x-forwarded-proto") || "";
    const forwardedHost = request?.headers?.get?.("x-forwarded-host") || "";
    if (forwardedHost) {
      const protocol = (forwardedProto || requestUrl.protocol).replace(/:$/, "").toLowerCase();
      if (!['http', 'https'].includes(protocol)) throw new Error("Invalid forwarded SAML protocol");
      return new URL(`${protocol}://${forwardedHost}`).origin;
    }
    return requestUrl.origin;
  }

  return "http://localhost:20128";
}

export function createSamlInstance(settings, origin, expectedRequestId = "") {
  const cert = formatX509Certificate(settings?.samlCert || "") || DUMMY_FALLBACK_CERT;
  const callbackUrl = `${origin}/api/auth/saml/acs`;
  const requestId = String(expectedRequestId || "").trim();
  return new SAML({
    entryPoint: settings?.samlEntryPoint || "https://example.com/sso",
    issuer: settings?.samlIssuer || "urn:router2k:sp",
    idpCert: cert,
    cert: cert,
    callbackUrl: callbackUrl,
    acceptedClockSkewMs: 60000,
    wantAssertionsSigned: true,
    validateInResponseTo: requestId ? "always" : "never",
    ...(requestId ? {
      cacheProvider: {
        async saveAsync() {},
        async getAsync(id) {
          return id === requestId ? new Date().toISOString() : null;
        },
        async removeAsync() {},
      },
    } : {}),
    requestIdExpirationMs: 28800000, // 8 hours
  });
}

/**
 * Builds SAML AuthnRequest redirect URL and returns { authorizeUrl, requestId }.
 * @param {Request} request
 * @param {object} settings
 * @returns {Promise<{ authorizeUrl: string, requestId: string }>}
 */
export async function buildSamlAuthorizeUrl(request, settings) {
  const origin = getSamlBaseUrl(request, settings);
  const samlInstance = createSamlInstance(settings, origin);

  const xml = await samlInstance.generateAuthorizeRequestAsync(false, false);
  const match = xml.match(/ID="([^"]+)"/);
  const requestId = match ? match[1] : "";
  if (!requestId.trim()) throw new Error("SAML AuthnRequest is missing a request ID");

  const authorizeUrl = await samlInstance._requestToUrlAsync(xml, null, "authorize", {});

  return { authorizeUrl, requestId };
}

/**
 * Validates SAML POST response from IdP ACS callback and returns user profile.
 * @param {Request} request
 * @param {object} body - Parsed form body or object containing SAMLResponse
 * @param {string} expectedRequestId - Request ID stored in saml_state cookie
 * @param {object} settings
 * @returns {Promise<object>}
 */
export async function validateSamlResponse(request, body, expectedRequestId, settings) {
  if (!settings?.samlCert) {
    throw new Error("IdP X.509 Certificate (samlCert) is missing or not configured");
  }

  const origin = getSamlBaseUrl(request, settings);
  const samlInstance = createSamlInstance(settings, origin, expectedRequestId);

  const container = typeof body === "object" && body !== null ? body : { SAMLResponse: body };
  const rawSamlResponse = container.SAMLResponse;

  if (!rawSamlResponse) {
    throw new Error("Missing SAMLResponse parameter in assertion POST body");
  }
  if (!String(expectedRequestId || "").trim()) {
    throw new Error("Missing SAML request state");
  }

  const xml = Buffer.from(rawSamlResponse, "base64").toString("utf8");
  const responseTag = xml.match(/^\uFEFF?\s*(?:<\?xml[^>]*>\s*)?<(?:[\w.-]+:)?Response\b([^>]*)>/i);
  const matches = [...(responseTag?.[1] || "").matchAll(/\bInResponseTo\s*=\s*(["'])(.*?)\1/gi)];
  const inResponseTo = matches.length === 1 ? matches[0][2] : null;
  if (!inResponseTo || inResponseTo !== expectedRequestId) {
    throw new Error(`InResponseTo mismatch: expected ${expectedRequestId}, received ${inResponseTo || "none"}`);
  }

  const result = await samlInstance.validatePostResponseAsync({ SAMLResponse: rawSamlResponse });
  const profile = result?.profile || result;

  return profile;
}

/**
 * Generates standard SP XML Metadata.
 * @param {string} origin
 * @param {object} settings
 * @returns {string}
 */
export function generateSamlMetadata(origin, settings) {
  const samlInstance = createSamlInstance(settings, origin);
  return samlInstance.generateServiceProviderMetadata();
}

/**
 * Extracts email claim from SAML profile assertion.
 * @param {object} profile
 * @param {object} settings
 * @returns {string}
 */
export function pickSamlEmail(profile = {}, settings = {}) {
  if (!profile) return "";

  // 1. Configured custom attribute
  const customAttr = settings.samlAttributeEmail;
  if (customAttr && profile[customAttr]) {
    const val = profile[customAttr];
    return Array.isArray(val) ? val[0] : String(val);
  }

  // 2. Common email claims
  const emailKeys = [
    "email",
    "emailAddress",
    "mail",
    "nameID",
    "nameId",
    "upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
  ];

  for (const key of emailKeys) {
    if (profile[key]) {
      const val = profile[key];
      return Array.isArray(val) ? val[0] : String(val);
    }
  }

  // 3. Fallback: check attributes object if present
  if (profile.attributes) {
    for (const key of emailKeys) {
      if (profile.attributes[key]) {
        const val = profile.attributes[key];
        return Array.isArray(val) ? val[0] : String(val);
      }
    }
  }

  return "";
}

/**
 * Extracts display name claim from SAML profile assertion.
 * @param {object} profile
 * @param {object} settings
 * @returns {string}
 */
export function pickSamlDisplayName(profile = {}, settings = {}) {
  if (!profile) return "";

  // 1. Configured custom attribute
  const customAttr = settings.samlAttributeName;
  if (customAttr && profile[customAttr]) {
    const val = profile[customAttr];
    return Array.isArray(val) ? val[0] : String(val);
  }

  // 2. Common name claims
  const nameKeys = [
    "displayName",
    "name",
    "cn",
    "commonName",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  ];

  for (const key of nameKeys) {
    if (profile[key]) {
      const val = profile[key];
      return Array.isArray(val) ? val[0] : String(val);
    }
  }

  // 3. Combined givenName + surname
  if (profile.givenName || profile.sn || profile.surname) {
    const given = profile.givenName || "";
    const surname = profile.sn || profile.surname || "";
    const combined = `${given} ${surname}`.trim();
    if (combined) return combined;
  }

  // 4. Fallback to email
  return pickSamlEmail(profile, settings);
}
