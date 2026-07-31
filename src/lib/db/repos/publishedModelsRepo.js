import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const SCOPE = "publishedModels";

export async function getPublishedModels() {
  const db = await getAdapter();
  return db
    .all(`SELECT key, value FROM kv WHERE scope = ?`, [SCOPE])
    .map((row) => ({ comboId: row.key, ...parseJson(row.value, {}) }))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

export async function addPublishedModel(comboId) {
  const db = await getAdapter();
  let added = false;
  db.transaction(() => {
    const existing = db.get(`SELECT 1 FROM kv WHERE scope = ? AND key = ?`, [SCOPE, comboId]);
    if (existing) return;
    db.run(`INSERT INTO kv(scope, key, value) VALUES(?, ?, ?)`, [
      SCOPE,
      comboId,
      stringifyJson({ createdAt: new Date().toISOString() }),
    ]);
    added = true;
  });
  return added;
}

export async function deletePublishedModel(comboId) {
  const db = await getAdapter();
  const result = db.run(`DELETE FROM kv WHERE scope = ? AND key = ?`, [SCOPE, comboId]);
  return (result?.changes ?? 0) > 0;
}
