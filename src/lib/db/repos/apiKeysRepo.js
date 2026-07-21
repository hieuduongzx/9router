import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    ownerUserId: row.ownerUserId || null,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
  };
}

export async function getApiKeys(ownerUserId) {
  const db = await getAdapter();
  const rows = ownerUserId
    ? db.all(`SELECT * FROM apiKeys WHERE ownerUserId = ? ORDER BY createdAt ASC`, [ownerUserId])
    : db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id, ownerUserId) {
  const db = await getAdapter();
  const row = ownerUserId
    ? db.get(`SELECT * FROM apiKeys WHERE id = ? AND ownerUserId = ?`, [id, ownerUserId])
    : db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, ownerUserId = null) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    ownerUserId,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, ownerUserId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, apiKey.ownerUserId, 1, apiKey.createdAt]
  );
  return apiKey;
}

export async function updateApiKey(id, data, ownerUserId) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = ownerUserId
      ? db.get(`SELECT * FROM apiKeys WHERE id = ? AND ownerUserId = ?`, [id, ownerUserId])
      : db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id, ownerUserId) {
  const db = await getAdapter();
  const res = ownerUserId
    ? db.run(`DELETE FROM apiKeys WHERE id = ? AND ownerUserId = ?`, [id, ownerUserId])
    : db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}
