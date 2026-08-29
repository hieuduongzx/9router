import { NextResponse } from "next/server";
import { getDistinctProviders } from "@/lib/requestDetailsDb";
import { getApiKeys, getProviderNodes } from "@/lib/localDb";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

/**
 * GET /api/usage/providers
 * Returns list of unique providers from request details
 */
export async function GET(request) {
  try {
    const owner = await getDashboardAccount(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const keys = await getApiKeys(owner.id);

    // Query DISTINCT provider column directly — avoids parsing every row's
    // full JSON blob (can be hundreds of MB), which previously caused OOM.
    const providerIds = await getDistinctProviders({
      apiKeys: keys.map((key) => key.key),
    });

    const nodeMap = {};
    if (owner.role === "admin") {
      const providerNodes = await getProviderNodes();
      for (const node of providerNodes) nodeMap[node.id] = node.name;
    }

    const providers = providerIds.map(providerId => {
      let name = providerId;
      if (nodeMap[providerId]) {
        name = nodeMap[providerId];
      } else {
        const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
        if (providerConfig?.name) name = providerConfig.name;
      }
      return { id: providerId, name };
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[API] Failed to get providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
