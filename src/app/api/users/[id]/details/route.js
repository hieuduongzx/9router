import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getApiKeys, getUserById, listCreditLedger, publicUser } from "@/lib/db/index.js";
import { getUsageStats } from "@/lib/usageDb";
import { USAGE_PERIOD_VALUES } from "@/shared/constants/usagePeriods";

// Derived from the shared dropdown list so the accounts pages cannot offer a
// range this endpoint would silently downgrade to the default.
const VALID_PERIODS = new Set(USAGE_PERIOD_VALUES);
const LEDGER_LIMIT = 25;
/** Usage rows mask keys as `slice(0, 8) + "***"` — match on that shared prefix. */
const KEY_PREFIX_LENGTH = 8;

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const account = await getDashboardAccount(request);
  if (!account || account.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const requestedPeriod = searchParams.get("period") || "30d";
  const period = VALID_PERIODS.has(requestedPeriod) ? requestedPeriod : "30d";
  const apiKeys = await getApiKeys(id);
  const [stats, ledger] = await Promise.all([
    getUsageStats(period, { apiKeyFilter: apiKeys.map((key) => key.key) }),
    listCreditLedger(id, { limit: LEDGER_LIMIT }),
  ]);

  // Per-key rollup so an admin can see which key drives the account's traffic.
  // `stats.byApiKey` rows only carry a masked key, so join on its plaintext prefix.
  const usageByPrefix = {};
  for (const row of Object.values(stats?.byApiKey || {})) {
    const prefix = String(row.apiKeyMasked || "").slice(0, KEY_PREFIX_LENGTH);
    if (!prefix) continue;
    const entry = usageByPrefix[prefix] || (usageByPrefix[prefix] = {
      requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, lastUsed: null,
    });
    entry.requests += row.requests || 0;
    entry.promptTokens += row.promptTokens || 0;
    entry.completionTokens += row.completionTokens || 0;
    entry.cost += row.cost || 0;
    if (row.lastUsed && (!entry.lastUsed || row.lastUsed > entry.lastUsed)) entry.lastUsed = row.lastUsed;
  }

  return NextResponse.json({
    user: publicUser(user),
    period,
    apiKeys: apiKeys.map(({ id: keyId, key, name, isActive, createdAt }) => ({
      id: keyId,
      key,
      name,
      isActive,
      createdAt,
      usage: usageByPrefix[String(key || "").slice(0, KEY_PREFIX_LENGTH)] || null,
    })),
    ledger,
    stats,
  });
}
