import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getUserById, listCreditLedger } from "@/lib/localDb";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    if (!account?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const user = await getUserById(account.id);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404, headers: NO_STORE });
    }

    const ledger = await listCreditLedger(account.id, { limit, offset });
    return NextResponse.json(
      {
        balanceCents: user.creditCents || 0,
        ...ledger,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to load wallet" },
      { status: 500, headers: NO_STORE },
    );
  }
}
