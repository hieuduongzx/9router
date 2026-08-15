import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { getPrimaryAdmin, getUserById, publicUser } from "@/lib/db/repos/usersRepo";
import { isOidcConfigured } from "@/lib/auth/oidc";
import { isSamlLoginEnabled } from "@/lib/auth/saml.js";
import { getDashboardAuthSession, renewDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import {
  DASHBOARD_VIEW_COOKIE,
  resolveDashboardViewMode,
} from "@/shared/constants/dashboardView";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request) {
  try {
    await getPrimaryAdmin();
    const settings = await getSettings();
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
    const account = session?.userId ? await getUserById(session.userId) : null;
    const activeAccount = account?.isActive ? account : null;

    // The dashboard polls this on every page load — use it to slide the session.
    // Fail-open: a renewal problem must never turn into a false "signed out".
    if (activeAccount) {
      try {
        await renewDashboardAuthCookie(cookieStore, request, session);
      } catch {}
    }
    const viewMode = resolveDashboardViewMode(
      activeAccount?.role,
      cookieStore.get(DASHBOARD_VIEW_COOKIE)?.value,
    );
    const canSwitchDashboardView = activeAccount?.role === "admin";
    const oidcName = String(session?.oidcName || "").trim();
    const oidcEmail = String(session?.oidcEmail || "").trim();
    const samlName = String(session?.samlName || "").trim();
    const samlEmail = String(session?.samlEmail || "").trim();
    const oidcLogin = !!activeAccount && session?.oidc === true;
    const samlLogin = !!activeAccount && session?.saml === true;
    const authenticated = !!activeAccount || oidcLogin || samlLogin;
    const authMode = settings.authMode || "password";
    const ssoType = settings.ssoType || (authMode === "saml" ? "saml" : "oidc");
    const oidcConfigured = isOidcConfigured(settings);
    const samlConfigured = isSamlLoginEnabled(settings);
    const ssoOnly = ["sso", "saml", "oidc"].includes(authMode);
    const selectedSsoConfigured = ssoType === "saml" ? samlConfigured : oidcConfigured;

    return NextResponse.json({
      requireLogin: settings.requireLogin !== false,
      authMode,
      ssoType,
      oidcConfigured,
      oidcLoginLabel: (settings.oidcLoginLabel || "Sign in with OIDC").trim() || "Sign in with OIDC",
      samlConfigured,
      samlLoginLabel: (settings.samlLoginLabel || "Sign in with SAML SSO").trim() || "Sign in with SAML SSO",
      hasPassword: !!settings.password,
      registrationEnabled: !ssoOnly || !selectedSsoConfigured,
      authenticated,
      displayName: samlLogin
        ? (samlName || samlEmail || "SAML user")
        : oidcLogin
          ? (oidcName || oidcEmail || activeAccount?.username || "")
          : (activeAccount?.username || ""),
      loginMethod: samlLogin ? "SAML" : oidcLogin ? "OIDC" : activeAccount ? "Account" : "",
      role: activeAccount?.role || ((oidcLogin || samlLogin) ? "user" : null),
      viewMode,
      isAdminView: canSwitchDashboardView && viewMode === "admin",
      canSwitchDashboardView,
      user: activeAccount ? publicUser(activeAccount) : null,
      oidcName: oidcName || null,
      oidcEmail: oidcEmail || null,
      oidcLogin,
      samlName: samlName || null,
      samlEmail: samlEmail || null,
      samlLogin,
    }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({
      requireLogin: true,
      authMode: "password",
      ssoType: "oidc",
      oidcConfigured: false,
      oidcLoginLabel: "Sign in with OIDC",
      samlConfigured: false,
      samlLoginLabel: "Sign in with SAML SSO",
      hasPassword: false,
      registrationEnabled: true,
      authenticated: false,
      displayName: "",
      loginMethod: "",
      role: null,
      viewMode: "user",
      isAdminView: false,
      canSwitchDashboardView: false,
      user: null,
      oidcName: null,
      oidcEmail: null,
      oidcLogin: false,
      samlName: null,
      samlEmail: null,
      samlLogin: false,
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
