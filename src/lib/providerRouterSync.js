import { getCombos, updateCombo } from "@/lib/db/repos/combosRepo.js";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { getProviderNodeById } from "@/lib/db/repos/nodesRepo.js";
import { getProviderAlias } from "@/shared/constants/providers.js";
import { providerMatchKeys } from "open-sse/services/model.js";
import { withProviderMembersEnabled } from "open-sse/services/comboMembers.js";
import { resetComboRotation } from "open-sse/services/combo.js";

function sameMembers(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function prefixesFor(providerId) {
  const prefixes = providerMatchKeys(providerId);
  const alias = getProviderAlias(providerId);
  if (alias) prefixes.add(alias);
  const node = await getProviderNodeById(providerId);
  const prefix = typeof node?.prefix === "string" ? node.prefix.trim() : "";
  if (prefix) prefixes.add(prefix);
  return prefixes;
}

/**
 * Keep router membership in step with the provider table switch.
 * Off only applies once no connection of this provider can still serve traffic,
 * so a second auth method that is still on does not blank the routers.
 * On puts this provider's members back, and leaves every other off-switch as it was.
 */
export async function syncRouterMembersForProvider(providerId, requestedEnabled) {
  const id = String(providerId || "").trim();
  if (!id) return { updated: 0, enabled: false, skipped: true };

  const connections = await getProviderConnections({ provider: id });
  const anyActive = connections.some((connection) => connection.isActive !== false);
  const enabled = requestedEnabled === true;

  if (enabled) {
    if (!anyActive) return { updated: 0, enabled: false, skipped: true };
  } else if (anyActive) {
    return { updated: 0, enabled: true, skipped: true };
  }

  const prefixes = await prefixesFor(id);
  const combos = await getCombos();
  let updated = 0;
  for (const combo of combos) {
    const next = withProviderMembersEnabled(combo.models, combo.disabledMembers, prefixes, enabled);
    if (sameMembers(next, combo.disabledMembers || [])) continue;
    const saved = await updateCombo(combo.id, { disabledMembers: next });
    if (saved?.name) resetComboRotation(saved.name);
    updated += 1;
  }
  return { updated, enabled, skipped: false };
}
