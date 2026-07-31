import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const SCOPE = "modelProviders";
const INIT_KEY = "__initialized__";
const DEFAULT_PROVIDERS = [
  { id: "openai", name: "OpenAI", iconKey: "openai" },
  { id: "anthropic", name: "Anthropic", iconKey: "anthropic" },
  { id: "google", name: "Google", iconKey: "google" },
  { id: "xai", name: "xAI", iconKey: "xai" },
  { id: "meta", name: "Meta", iconKey: "meta" },
  { id: "deepseek", name: "DeepSeek", iconKey: "deepseek" },
  { id: "mistral", name: "Mistral", iconKey: "mistral" },
  { id: "qwen", name: "Qwen", iconKey: "qwen" },
  { id: "moonshot", name: "Moonshot AI", iconKey: "moonshot" },
  { id: "cohere", name: "Cohere", iconKey: "cohere" },
];

function rowToProvider(row) {
  if (!row) return null;
  return { id: row.key, ...parseJson(row.value, {}) };
}

function ensureDefaults(db) {
  const initialized = db.get(`SELECT 1 FROM kv WHERE scope = ? AND key = ?`, [SCOPE, INIT_KEY]);
  if (initialized) return;

  const now = new Date().toISOString();
  db.transaction(() => {
    for (const provider of DEFAULT_PROVIDERS) {
      db.run(`INSERT OR IGNORE INTO kv(scope, key, value) VALUES(?, ?, ?)`, [
        SCOPE,
        provider.id,
        stringifyJson({
          name: provider.name,
          iconKey: provider.iconKey,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
    }
    db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES(?, ?, ?)`, [
      SCOPE,
      INIT_KEY,
      stringifyJson(true),
    ]);
  });
}

function listProviders(db) {
  ensureDefaults(db);
  return db
    .all(`SELECT key, value FROM kv WHERE scope = ? AND key != ?`, [SCOPE, INIT_KEY])
    .map(rowToProvider)
    .filter((provider) => provider?.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getModelProviders() {
  const db = await getAdapter();
  return listProviders(db);
}

export async function getModelProviderByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;
  const db = await getAdapter();
  return listProviders(db).find((provider) => provider.name.toLowerCase() === normalized) || null;
}

export async function createModelProvider({ name, iconKey }) {
  const db = await getAdapter();
  const normalizedName = String(name || "").trim();
  ensureDefaults(db);
  if (listProviders(db).some((provider) => provider.name.toLowerCase() === normalizedName.toLowerCase())) {
    return null;
  }

  const now = new Date().toISOString();
  const provider = {
    id: uuidv4(),
    name: normalizedName,
    iconKey: String(iconKey || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  db.run(`INSERT INTO kv(scope, key, value) VALUES(?, ?, ?)`, [
    SCOPE,
    provider.id,
    stringifyJson({
      name: provider.name,
      iconKey: provider.iconKey,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    }),
  ]);
  return provider;
}

export async function updateModelProvider(id, { name, iconKey }) {
  const db = await getAdapter();
  ensureDefaults(db);
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT key, value FROM kv WHERE scope = ? AND key = ?`, [SCOPE, id]);
    const current = rowToProvider(row);
    if (!current) return;

    const nextName = String(name || "").trim();
    const duplicate = listProviders(db).some(
      (provider) => provider.id !== id && provider.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      result = { duplicate: true };
      return;
    }

    const next = {
      ...current,
      name: nextName,
      iconKey: String(iconKey || "").trim(),
      updatedAt: new Date().toISOString(),
    };
    db.run(`UPDATE kv SET value = ? WHERE scope = ? AND key = ?`, [
      stringifyJson({
        name: next.name,
        iconKey: next.iconKey,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      }),
      SCOPE,
      id,
    ]);
    if (current.name.toLowerCase() !== next.name.toLowerCase()) {
      db.run(`UPDATE combos SET modelProvider = ? WHERE modelProvider = ? COLLATE NOCASE`, [
        next.name,
        current.name,
      ]);
    }
    result = next;
  });
  return result;
}

export async function deleteModelProvider(id) {
  const db = await getAdapter();
  ensureDefaults(db);
  const row = db.get(`SELECT key, value FROM kv WHERE scope = ? AND key = ?`, [SCOPE, id]);
  const provider = rowToProvider(row);
  if (!provider) return { deleted: false, notFound: true, usageCount: 0 };

  const usage = db.get(`SELECT COUNT(*) AS count FROM combos WHERE modelProvider = ? COLLATE NOCASE`, [provider.name]);
  const usageCount = Number(usage?.count) || 0;
  if (usageCount > 0) return { deleted: false, usageCount };

  db.run(`DELETE FROM kv WHERE scope = ? AND key = ?`, [SCOPE, id]);
  return { deleted: true, usageCount: 0 };
}
