import { NextResponse } from "next/server";
import { syncRouterMembersForProvider } from "@/lib/providerRouterSync";

export const dynamic = "force-dynamic";

// POST /api/combos/provider-members
// Body: { providerId, enabled }
// Called after the provider table switch so router members follow that provider.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId || providerId.length > 200) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
    }

    const result = await syncRouterMembersForProvider(providerId, body.enabled);
    return NextResponse.json(result);
  } catch (error) {
    console.log("Error syncing router members:", error);
    return NextResponse.json({ error: "Failed to update router models" }, { status: 500 });
  }
}
