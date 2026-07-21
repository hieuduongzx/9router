import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { listUsers } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const account = await getDashboardAccount(request);
  if (!account || account.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json({ users, currentUserId: account.id });
}
