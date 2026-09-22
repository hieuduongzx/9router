export async function syncRouterMembers(providerId, enabled) {
  const response = await fetch("/api/combos/provider-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, enabled: enabled === true }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Failed to update router models");
  return body;
}

export function routerSyncNotice(enabled, updated) {
  const count = Number(updated) || 0;
  if (count < 1) return "";
  const routes = count === 1 ? "1 router" : `${count} routers`;
  return enabled
    ? `Turned this provider's models back on in ${routes}`
    : `Turned this provider's models off in ${routes}`;
}
