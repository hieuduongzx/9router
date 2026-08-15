import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { DEFAULT_HEADROOM_URL, getHeadroomStatus } from "@/lib/headroom/detect";
import { getManagedPid } from "@/lib/headroom/process";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserTokenSaverSettings } from "@/lib/db/repos/userSettingsRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    // Which proxy URL to probe is the signed-in account's own preference.
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
    const prefs = session?.userId ? await getUserTokenSaverSettings(session.userId) : null;
    const url = prefs?.headroomUrl || settings.headroomUrl || DEFAULT_HEADROOM_URL;
    const status = await getHeadroomStatus(url);
    const managedPid = getManagedPid();
    return NextResponse.json({ ...status, url, managedPid });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
