/**
 * Route membership: which of a combo's configured models are actually routable.
 *
 * A member can be switched off in the dashboard without being removed, so the
 * ordered `models` list stays intact while `disabledMembers` names the ones the
 * router must skip. Members are stored by model string, not index — reordering
 * or editing the list must never silently switch a different member off.
 *
 * Dependency-free on purpose: the routing engine, the SQLite repo and the
 * dashboard client bundle all read this, and none of them should pull the
 * others' imports in to do it.
 */

/**
 * @param {unknown} value - persisted disabledMembers column
 * @param {string[]} [models] - member list to validate against; entries not in
 *   it are dropped so the column cannot accumulate stale ids
 * @returns {string[]}
 */
export function normalizeDisabledMembers(value, models) {
  if (!Array.isArray(value)) return [];
  const allowed = Array.isArray(models)
    ? new Set(models.map((model) => String(model || "").trim()))
    : null;
  const seen = new Set();
  const disabled = [];
  for (const entry of value) {
    const member = String(entry || "").trim();
    if (!member || seen.has(member)) continue;
    if (allowed && !allowed.has(member)) continue;
    seen.add(member);
    disabled.push(member);
  }
  return disabled;
}

/**
 * The members a request routes through: configured order minus switched off.
 * Returns the original array when nothing is disabled, so the common path
 * neither copies nor allocates.
 *
 * @param {{models?: string[], disabledMembers?: string[]}} combo
 * @returns {string[]}
 */
export function comboRoutedModels(combo) {
  const models = Array.isArray(combo?.models) ? combo.models : [];
  const disabledList = combo?.disabledMembers;
  if (!Array.isArray(disabledList) || disabledList.length === 0) return models;
  const disabled = new Set(disabledList);
  return models.filter((model) => !disabled.has(model));
}
