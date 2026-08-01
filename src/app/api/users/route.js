import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { createUser, getApiKeys, getUsageByOwner, listUsers } from "@/lib/db/index.js";
import { USAGE_PERIOD_VALUES } from "@/shared/constants/usagePeriods";

export const dynamic = "force-dynamic";

// Derived from the shared dropdown list so the accounts pages cannot offer a
// range this endpoint would silently downgrade to the default.
const VALID_PERIODS = new Set(USAGE_PERIOD_VALUES);
const MAX_CREDIT_CENTS = 100_000_000;

export async function GET(request) {
  const account = await getDashboardAccount(request);
  if (!account || account.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const requestedPeriod = new URL(request.url).searchParams.get("period") || "30d";
  const period = VALID_PERIODS.has(requestedPeriod) ? requestedPeriod : "30d";

  const users = await listUsers();
  // Key counts and activity are read once and joined in memory — the accounts list
  // needs them per row and both sources are single queries.
  const [apiKeys, usageByOwner] = await Promise.all([
    getApiKeys().catch(() => []),
    getUsageByOwner(period).catch(() => ({})),
  ]);

  const keyStats = {};
  for (const key of apiKeys) {
    if (!key.ownerUserId) continue;
    const entry = keyStats[key.ownerUserId] || (keyStats[key.ownerUserId] = { total: 0, active: 0 });
    entry.total += 1;
    if (key.isActive) entry.active += 1;
  }

  return NextResponse.json({
    period,
    currentUserId: account.id,
    unassignedKeyCount: apiKeys.filter((key) => !key.ownerUserId).length,
    users: users.map((user) => {
      const keys = keyStats[user.id] || { total: 0, active: 0 };
      const usage = usageByOwner[user.id];
      return {
        ...user,
        apiKeyCount: keys.total,
        activeApiKeyCount: keys.active,
        requestsInPeriod: usage?.requestsInPeriod || 0,
        costInPeriod: usage?.costInPeriod || 0,
        totalRequests: usage?.requests || 0,
        lastUsedAt: usage?.lastUsed || null,
      };
    }),
  });
}

export async function POST(request) {
  try {
    const account = await getDashboardAccount(request);
    if (!account || account.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const role = body.role === "admin" ? "admin" : "user";
    const initialCreditCents = Number(body.initialCreditCents) || 0;
    if (!Number.isSafeInteger(initialCreditCents) || initialCreditCents < 0 || initialCreditCents > MAX_CREDIT_CENTS) {
      return NextResponse.json({ error: "Starting credit must be between $0.00 and $1,000,000.00" }, { status: 400 });
    }

    const user = await createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      role,
      initialCreditCents,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to create account" }, { status: 400 });
  }
}
