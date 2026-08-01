import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/usageDb";
import { getApiKeys, getUserById } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

/**
 * GET /api/usage/request-details
 * Query parameters: page, pageSize (1-100), provider, model, connectionId, status,
 * startDate, endDate, userId (admin only), apiKeyId
 */
export async function GET(request) {
  try {
    const owner = await getDashboardAccount(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    
    const pageRaw = parseInt(searchParams.get("page"));
    const page = Number.isNaN(pageRaw) ? 1 : pageRaw;
    const pageSizeRaw = parseInt(searchParams.get("pageSize"));
    const pageSize = Number.isNaN(pageSizeRaw) ? 20 : pageSizeRaw;
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");
    const connectionId = searchParams.get("connectionId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const apiKeyId = searchParams.get("apiKeyId");

    if (page < 1) {
      return NextResponse.json(
        { error: "Page must be >= 1" },
        { status: 400 }
      );
    }
    
    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: "PageSize must be between 1 and 100" },
        { status: 400 }
      );
    }
    
    const filter = {
      page,
      pageSize
    };
    
    if (provider) filter.provider = provider;
    if (model) filter.model = model;
    if (connectionId) filter.connectionId = connectionId;
    if (status) filter.status = status;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    if (userId && owner.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }
    if (userId && !(await getUserById(userId))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // Scope is always derived from the keys this account owns, so narrowing by
    // apiKeyId can only ever select a subset — an id from another account
    // matches nothing rather than widening access.
    const keys = await getApiKeys(userId || owner.id);
    const scopedKeys = apiKeyId ? keys.filter((key) => key.id === apiKeyId) : keys;
    if (apiKeyId && scopedKeys.length === 0) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }
    filter.apiKeys = scopedKeys.map((key) => key.key);
    
    const result = await getRequestDetails(filter);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to get request details:", error);
    return NextResponse.json(
      { error: "Failed to fetch request details" },
      { status: 500 }
    );
  }
}
