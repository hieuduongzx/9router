import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToCombo(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    modelProvider: row.modelProvider || null,
    models: parseJson(row.models, []),
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
  const combo = {
    id: uuidv4(),
    name: data.name,
    kind: data.kind || null,
    modelProvider: data.modelProvider || null,
    models: data.models || [],
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO combos(id, name, kind, modelProvider, models, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [combo.id, combo.name, combo.kind, combo.modelProvider, stringifyJson(combo.models), combo.createdAt, combo.updatedAt]
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
    db.run(
      `UPDATE combos SET name = ?, kind = ?, modelProvider = ?, models = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.kind, merged.modelProvider || null, stringifyJson(merged.models || []), merged.updatedAt, id]
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
