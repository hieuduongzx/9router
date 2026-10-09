import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { keyAccessFromColumns, keyAccessToColumns } from "@/shared/utils/keyAccess.js";
import { KEY_ACCESS_UNRESTRICTED } from "@/shared/constants/keyAccess.js";

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
    access: keyAccessFromColumns(row.accessRestricted, row.accessAllow),
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

// Used by the /v1 handlers to read the presented key's access settings.
export async function getApiKeyByKey(key) {
  if (!key) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
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
    access: { restricted: false, allow: [] },
  };
  const cols = keyAccessToColumns(KEY_ACCESS_UNRESTRICTED);
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, ownerUserId, isActive, createdAt, accessRestricted, accessAllow) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, apiKey.ownerUserId, 1, apiKey.createdAt, cols.accessRestricted, cols.accessAllow]
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
    const cols = keyAccessToColumns(merged.access);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, accessRestricted = ?, accessAllow = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, cols.accessRestricted, cols.accessAllow, id]
    );
    result = rowToKey(db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]));
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

export async function resolveApiKey(key) {
  if (!key || typeof key !== "string") return null;
  const db = await getAdapter();
  const row = db.get(
    `SELECT k.id, k.key, k.name, k.machineId, k.ownerUserId, k.isActive, k.createdAt,
            u.id AS ownerId, u.username AS ownerUsername, u.role AS ownerRole,
            u.isActive AS ownerIsActive, u.creditCents AS ownerCreditCents
       FROM apiKeys k
       LEFT JOIN users u ON u.id = k.ownerUserId
      WHERE k.key = ?`,
    [key],
  );
  if (!row) return null;
  const isActive = row.isActive === 1 || row.isActive === true;
  const owner =
    row.ownerId
      ? {
          id: row.ownerId,
          username: row.ownerUsername || "",
          role: row.ownerRole === "admin" ? "admin" : "user",
          isActive: row.ownerIsActive === 1 || row.ownerIsActive === true,
          creditCents: Number.isSafeInteger(row.ownerCreditCents)
            ? row.ownerCreditCents
            : Number(row.ownerCreditCents) || 0,
        }
      : null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    ownerUserId: row.ownerUserId || owner?.id || null,
    isActive,
    createdAt: row.createdAt,
    owner,
  };
}

export async function validateApiKey(key) {
  const resolved = await resolveApiKey(key);
  return !!(resolved && resolved.isActive);
}
