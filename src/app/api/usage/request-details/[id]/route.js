import { NextResponse } from "next/server";
import { getRequestDetailById } from "@/lib/usageDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

export async function GET(request, { params }) {
  try {
    const account = await getDashboardAccount(request);
    if (account?.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const { id } = await params;
    const detail = await getRequestDetailById(id);
    if (!detail) {
      return NextResponse.json({ error: "Request detail not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[API] Failed to get request detail:", error);
    return NextResponse.json({ error: "Failed to fetch request detail" }, { status: 500 });
  }
}
