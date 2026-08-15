import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { resolveOrProvisionExternalIdentity } from "@/lib/db/repos/externalIdentitiesRepo";
import {
  getSamlBaseUrl,
  isSamlLoginEnabled,
  pickSamlDisplayName,
  pickSamlEmail,
  validateSamlResponse,
} from "@/lib/auth/saml.js";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";

async function resolveSamlAccount({ profile, settings }) {
  const subject = String(profile?.nameID || profile?.nameId || "").trim();
  if (!subject) throw new Error("SAML identity is missing a subject");

  const providerNamespace = `saml:${String(profile?.issuer || settings.samlEntryPoint).trim()}`;
  const account = await resolveOrProvisionExternalIdentity(providerNamespace, subject, {
    usernamePrefix: "saml",
  });

  if (!account?.isActive) throw new Error("This account is disabled");
  return account;
}

export async function POST(request) {
  const settings = await getSettings();
  const origin = getSamlBaseUrl(request, settings);
  const ip = getClientIp(request);

  const lock = checkLock(ip);
  if (lock.locked) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(`Too many failed attempts. Try again in ${lock.retryAfter}s.`)}`,
        origin
      )
    );
  }

  const cookieStore = await cookies();
  const storedRequestId = cookieStore.get("saml_state")?.value || "";

  // Always clear saml_state cookie after attempt
  cookieStore.delete("saml_state");

  try {
    if (!storedRequestId) {
      recordFail(ip);
      return NextResponse.redirect(new URL("/login?error=saml_missing_state", origin));
    }

    if (!isSamlLoginEnabled(settings)) {
      recordFail(ip);
      return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
    }

    const formData = await request.formData();
    const SAMLResponse = formData.get("SAMLResponse");

    if (!SAMLResponse) {
      recordFail(ip);
      return NextResponse.redirect(new URL("/login?error=saml_missing_response", origin));
    }

    const profile = await validateSamlResponse(request, { SAMLResponse }, storedRequestId, settings);

    const samlEmail = pickSamlEmail(profile, settings) || null;
    const samlName = pickSamlDisplayName(profile, settings) || "SAML user";
    const account = await resolveSamlAccount({ profile, settings });

    recordSuccess(ip);

    await setDashboardAuthCookie(cookieStore, request, {
      saml: true,
      userId: account.id,
      role: account.role,
      samlEmail,
      samlName,
    });

    return NextResponse.redirect(new URL("/dashboard", origin));
  } catch (error) {
    recordFail(ip);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message || "saml_acs_failed")}`, origin)
    );
  }
}
