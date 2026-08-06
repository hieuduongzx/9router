import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { getPrimaryAdmin, getUserById, publicUser } from "@/lib/db/repos/usersRepo";
import { isOidcConfigured } from "@/lib/auth/oidc";
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
    if (activeAccount || session?.oidc) {
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
    const oidcLogin = !!session?.oidc;
    const authenticated = !!activeAccount || oidcLogin;
    const authMode = settings.authMode || "password";
    const oidcConfigured = isOidcConfigured(settings);

    return NextResponse.json({
      requireLogin: settings.requireLogin !== false,
      authMode,
      oidcConfigured,
      oidcLoginLabel: (settings.oidcLoginLabel || "Sign in with OIDC").trim() || "Sign in with OIDC",
      hasPassword: !!settings.password,
      registrationEnabled: authMode !== "oidc" || !oidcConfigured,
      authenticated,
      displayName: oidcLogin ? (oidcName || oidcEmail || activeAccount?.username || "") : (activeAccount?.username || ""),
      loginMethod: oidcLogin ? "OIDC" : activeAccount ? "Account" : "",
      role: activeAccount?.role || (oidcLogin ? "user" : null),
      viewMode,
      isAdminView: canSwitchDashboardView && viewMode === "admin",
      canSwitchDashboardView,
      user: activeAccount ? publicUser(activeAccount) : null,
      oidcName: oidcName || null,
      oidcEmail: oidcEmail || null,
      oidcLogin,
    }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({
      requireLogin: true,
      authMode: "password",
      oidcConfigured: false,
      oidcLoginLabel: "Sign in with OIDC",
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
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
