import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { normalizeDisabledMembers } from "open-sse/services/comboMembers.js";
import { normalizeCapabilityOverrides, normalizeThinkingMode } from "@/shared/utils/comboModelConfig";

function rowToCombo(row) {
  if (!row) return null;
  const models = parseJson(row.models, []);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    modelProvider: row.modelProvider || null,
    models,
    thinkingMode: normalizeThinkingMode(row.thinkingMode),
    capabilityOverrides: normalizeCapabilityOverrides(parseJson(row.capabilityOverrides, {})),
    disabledMembers: normalizeDisabledMembers(parseJson(row.disabledMembers, []), models),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCombos() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM combos ORDER BY createdAt ASC`);
  return rows.map(rowToCombo);
}

export async function getComboById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
  return rowToCombo(row);
}

export async function getComboByName(name) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM combos WHERE name = ?`, [name]);
  return rowToCombo(row);
}

export async function createCombo(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const models = data.models || [];
  const combo = {
    id: uuidv4(),
    name: data.name,
    kind: data.kind || null,
    modelProvider: data.modelProvider || null,
    models,
    thinkingMode: normalizeThinkingMode(data.thinkingMode),
    capabilityOverrides: normalizeCapabilityOverrides(data.capabilityOverrides),
    disabledMembers: normalizeDisabledMembers(data.disabledMembers, models),
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO combos(id, name, kind, modelProvider, models, thinkingMode, capabilityOverrides, disabledMembers, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [combo.id, combo.name, combo.kind, combo.modelProvider, stringifyJson(combo.models), combo.thinkingMode, stringifyJson(combo.capabilityOverrides), stringifyJson(combo.disabledMembers), combo.createdAt, combo.updatedAt]
  );
  return combo;
}

export async function updateCombo(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToCombo(row), ...data, updatedAt: new Date().toISOString() };
    merged.thinkingMode = normalizeThinkingMode(merged.thinkingMode);
    merged.capabilityOverrides = normalizeCapabilityOverrides(merged.capabilityOverrides);
    // Re-filter against the (possibly new) member list so an edited-away member
    // never leaves a dangling off-switch behind.
    merged.disabledMembers = normalizeDisabledMembers(merged.disabledMembers, merged.models || []);
    db.run(
      `UPDATE combos SET name = ?, kind = ?, modelProvider = ?, models = ?, thinkingMode = ?, capabilityOverrides = ?, disabledMembers = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.kind, merged.modelProvider || null, stringifyJson(merged.models || []), merged.thinkingMode, stringifyJson(merged.capabilityOverrides), stringifyJson(merged.disabledMembers), merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteCombo(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM kv WHERE scope = 'publishedModels' AND key = ?`, [id]);
  const res = db.run(`DELETE FROM combos WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}
