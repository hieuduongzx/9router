import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getTopupByInvoice } from "@/lib/db/index.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const account = await getDashboardAccount(request);
  if (!account?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoice = decodeURIComponent((await params).invoice || "");
  const topup = await getTopupByInvoice(invoice);
  if (!topup || topup.userId !== account.id) return NextResponse.json({ error: "Top-up not found" }, { status: 404 });
  return NextResponse.json({ topup }, { headers: { "Cache-Control": "no-store" } });
}
