import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { getPxpipeStatus } from "@/lib/pxpipe/service.js";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserTokenSaverSettings } from "@/lib/db/repos/userSettingsRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    const status = getPxpipeStatus();
    // Enable/min chars/timeout are the signed-in account's own preferences;
    // auto-install stays a host-wide (admin) policy.
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
    const prefs = session?.userId ? await getUserTokenSaverSettings(session.userId) : null;
    return NextResponse.json({
      ...status,
      enabled: prefs ? !!prefs.pxpipeEnabled : !!settings.pxpipeEnabled,
      autoInstall: !!settings.pxpipeAutoInstall,
      minChars: prefs ? prefs.pxpipeMinChars : settings.pxpipeMinChars,
      timeoutMs: prefs ? prefs.pxpipeTimeoutMs : settings.pxpipeTimeoutMs,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
