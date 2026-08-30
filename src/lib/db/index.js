// Public API barrel — all DB functions
import { getAdapter } from "./driver.js";
import { stringifyJson, parseJson } from "./helpers/jsonCol.js";

// Settings
export {
  getSettings, updateSettings, isCloudEnabled, getCloudUrl, exportSettings,
} from "./repos/settingsRepo.js";

// Dashboard users
export {
  USER_ROLES,
  publicUser, validateRegistrationInput, validateUserProfileInput,
  getPrimaryAdmin, getUserById, getUserByLogin, createUser, listUsers,
  updateUserProfile, updateUserAccess, adjustUserCredit, setUserCreditBalance,
  usdCostToCents, debitUserCreditForUsage, deleteUserAccount,
  verifyUserCredentials, verifyUserPassword, updateUserPassword,
  hasSecureAdminAccount, resetRecoveryAdminCredentials,
} from "./repos/usersRepo.js";

export {
  getUserByExternalIdentity, resolveOrProvisionExternalIdentity,
} from "./repos/externalIdentitiesRepo.js";

// Per-account preferences (token saver)
export {
  DEFAULT_USER_TOKEN_SAVER_SETTINGS,
  getUserSettings, getUserTokenSaverSettings, updateUserSettings,
} from "./repos/userSettingsRepo.js";

export {
  listCreditLedger,
} from "./repos/creditLedgerRepo.js";

// Provider connections
export {
  getProviderConnections, getProviderConnectionById,
  createProviderConnection, updateProviderConnection,
  deleteProviderConnection, deleteProviderConnectionsByProvider,
  reorderProviderConnections, cleanupProviderConnections,
} from "./repos/connectionsRepo.js";

// Provider nodes
export {
  getProviderNodes, getProviderNodeById,
  createProviderNode, updateProviderNode, deleteProviderNode,
} from "./repos/nodesRepo.js";

// Proxy pools
export {
  getProxyPools, getProxyPoolById,
  createProxyPool, updateProxyPool, deleteProxyPool,
} from "./repos/proxyPoolsRepo.js";

// API keys
export {
  getApiKeys, getApiKeyById, createApiKey, updateApiKey, deleteApiKey, validateApiKey, resolveApiKey,
} from "./repos/apiKeysRepo.js";

// Combos
export {
  getCombos, getComboById, getComboByName,
  createCombo, updateCombo, deleteCombo,
} from "./repos/combosRepo.js";

// Models explicitly published from dashboard/models
export {
  getPublishedModels, addPublishedModel, deletePublishedModel,
} from "./repos/publishedModelsRepo.js";

// Virtual model providers used for public catalog ownership
export {
  getModelProviders, getModelProviderByName,
  createModelProvider, updateModelProvider, deleteModelProvider,
} from "./repos/modelProvidersRepo.js";

// Aliases (model + custom + mitm)
export {
  getModelAliases, setModelAlias, deleteModelAlias,
  getCustomModels, addCustomModel, deleteCustomModel,
  getMitmAlias, setMitmAliasAll,
} from "./repos/aliasRepo.js";

// Pricing
export {
  getPricing, getPricingForModel, getModelPricingCatalog,
  updatePricing, resetPricing, resetAllPricing,
} from "./repos/pricingRepo.js";

// Disabled models
export {
  getDisabledModels, getDisabledByProvider, disableModels, enableModels,
} from "./repos/disabledModelsRepo.js";

// Usage
export {
  statsEmitter, trackPendingRequest, getActiveRequests,
  saveRequestUsage, saveRequestFailure, getUsageHistory, getUsageStats, getSystemUsageOverview, getChartData,
  getUsageByOwner, getModelRanking, pruneUsageHistory,
  appendRequestLog, getRecentLogs, getRequestLogsPage,
} from "./repos/usageRepo.js";

// Request details
export {
  saveRequestDetail, getRequestDetails, getRequestDetailById, getDistinctProviders,
} from "./repos/requestDetailsRepo.js";
export {
  TOPUP_STATUS, createTopup, getTopupByInvoice, getTopupByWebhookContent, listTopups, settleTopup,
} from "./repos/topupsRepo.js";

// Export/import full DB
export async function exportDb() {
  const db = await getAdapter();
  const { exportSettings } = await import("./repos/settingsRepo.js");

  const out = {
    settings: await exportSettings(),
    providerConnections: db.all(`SELECT * FROM providerConnections`).map((r) => ({ ...parseJson(r.data, {}), id: r.id, provider: r.provider, authType: r.authType, name: r.name, email: r.email, priority: r.priority, isActive: r.isActive === 1, createdAt: r.createdAt, updatedAt: r.updatedAt })),
    providerNodes: db.all(`SELECT * FROM providerNodes`).map((r) => ({ ...parseJson(r.data, {}), id: r.id, type: r.type, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt })),
    proxyPools: db.all(`SELECT * FROM proxyPools`).map((r) => ({ ...parseJson(r.data, {}), id: r.id, isActive: r.isActive === 1, testStatus: r.testStatus, createdAt: r.createdAt, updatedAt: r.updatedAt })),
    // ownerUserId must survive the round-trip: authorizeBillableApiKey rejects an
    // ownerless key with 403, so dropping it here silently bricks every key on restore.
    apiKeys: db.all(`SELECT * FROM apiKeys`).map((r) => ({ id: r.id, key: r.key, name: r.name, machineId: r.machineId, ownerUserId: r.ownerUserId || null, isActive: r.isActive === 1, createdAt: r.createdAt })),
    // Accounts and their balances are part of the gateway's state, not telemetry —
    // a backup without them restores a gateway nobody can sign into or bill.
    users: db.all(`SELECT * FROM users`).map((r) => ({
      id: r.id, username: r.username, email: r.email, passwordHash: r.passwordHash,
      role: r.role, isActive: r.isActive === 1, mustChangePassword: r.mustChangePassword === 1,
      creditCents: Number(r.creditCents) || 0, createdAt: r.createdAt, updatedAt: r.updatedAt,
    })),
    creditLedger: db.all(`SELECT * FROM creditLedger ORDER BY createdAt ASC`).map((r) => ({
      id: r.id, userId: r.userId, amountCents: Number(r.amountCents) || 0,
      balanceAfterCents: Number(r.balanceAfterCents) || 0, type: r.type, source: r.source,
      note: r.note, actorUserId: r.actorUserId, meta: r.meta, createdAt: r.createdAt,
    })),
    paymentTopups: db.all(`SELECT * FROM paymentTopups ORDER BY createdAt ASC`).map((r) => ({
      id: r.id, userId: r.userId, invoiceNumber: r.invoiceNumber,
      sepayOrderId: r.sepayOrderId, sepayTransactionId: r.sepayTransactionId,
      amountVnd: Number(r.amountVnd) || 0, creditCents: Number(r.creditCents) || 0,
      status: r.status, paymentMethod: r.paymentMethod, rawData: r.rawData,
      createdAt: r.createdAt, paidAt: r.paidAt,
    })),
    userSettings: db.all(`SELECT userId, data FROM userSettings`).map((r) => ({
      userId: r.userId, data: parseJson(r.data, {}),
    })),
    externalIdentities: db.all(`SELECT * FROM externalIdentities`),
    combos: db.all(`SELECT * FROM combos`).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      modelProvider: r.modelProvider,
      models: parseJson(r.models, []),
      thinkingMode: r.thinkingMode || "auto",
      capabilityOverrides: parseJson(r.capabilityOverrides, {}),
      disabledMembers: parseJson(r.disabledMembers, []),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    modelAliases: {},
    customModels: [],
    publishedModels: [],
    modelProviders: [],
    mitmAlias: {},
    pricing: {},
    disabledModels: {},
  };

  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'modelAliases'`)) out.modelAliases[r.key] = parseJson(r.value);
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'customModels'`)) out.customModels.push(parseJson(r.value));
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'publishedModels'`)) out.publishedModels.push({ comboId: r.key, ...parseJson(r.value, {}) });
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'modelProviders' AND key != '__initialized__'`)) out.modelProviders.push({ id: r.key, ...parseJson(r.value, {}) });
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'mitmAlias'`)) out.mitmAlias[r.key] = parseJson(r.value);
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'pricing'`)) out.pricing[r.key] = parseJson(r.value);
  for (const r of db.all(`SELECT key, value FROM kv WHERE scope = 'disabledModels'`)) out.disabledModels[r.key] = parseJson(r.value);

  return out;
}

export async function importDb(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid database payload");
  }
  const db = await getAdapter();

  // Import wipes every table it manages. Take a restore point first — this is
  // otherwise the one destructive operation in the app with no way back.
  try {
    const { makeBackupDir, backupDbLite, pruneOldBackups } = await import("./backup.js");
    const dir = makeBackupDir("pre-import");
    if (dir) {
      backupDbLite(db, dir);
      pruneOldBackups();
      console.log(`[importDb] pre-import backup written to ${dir}`);
    }
  } catch (e) {
    console.warn("[importDb] pre-import backup failed:", e?.message || e);
  }

  // Restoring accounts is opt-in on the payload: an older export has no `users`
  // key, and wiping the live accounts to match it would lock everyone out.
  const restoreAccounts = Array.isArray(payload.users);

  db.transaction(() => {
    // Wipe all tables (keep _meta)
    db.run(`DELETE FROM settings`);
    db.run(`DELETE FROM providerConnections`);
    db.run(`DELETE FROM providerNodes`);
    db.run(`DELETE FROM proxyPools`);
    db.run(`DELETE FROM apiKeys`);
    db.run(`DELETE FROM combos`);
    if (restoreAccounts) {
      // creditLedger and apiKeys.ownerUserId both FK to users — clear children first.
      db.run(`DELETE FROM creditLedger`);
      db.run(`DELETE FROM paymentTopups`);
      db.run(`DELETE FROM userSettings`);
      db.run(`DELETE FROM externalIdentities`);
      db.run(`DELETE FROM users`);
    }
    db.run(`DELETE FROM kv WHERE scope IN ('modelAliases', 'customModels', 'publishedModels', 'modelProviders', 'mitmAlias', 'pricing', 'disabledModels')`);

    // Users must land before apiKeys and creditLedger so their FKs resolve.
    if (restoreAccounts) {
      for (const u of payload.users) {
        if (!u?.id || !u?.username) continue;
        db.run(
          `INSERT OR REPLACE INTO users(id, username, email, passwordHash, role, isActive, mustChangePassword, creditCents, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id, u.username, u.email, u.passwordHash,
            u.role === "admin" ? "admin" : "user",
            u.isActive === false ? 0 : 1,
            u.mustChangePassword ? 1 : 0,
            Math.max(0, Number(u.creditCents) || 0),
            u.createdAt || new Date().toISOString(), u.updatedAt || new Date().toISOString(),
          ]
        );
      }
      for (const e of payload.creditLedger || []) {
        if (!e?.id || !e?.userId) continue;
        db.run(
          `INSERT OR REPLACE INTO creditLedger(id, userId, amountCents, balanceAfterCents, type, source, note, actorUserId, meta, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id, e.userId, Number(e.amountCents) || 0, Math.max(0, Number(e.balanceAfterCents) || 0),
            e.type || "adjustment", e.source || null, e.note || null, e.actorUserId || null,
            typeof e.meta === "string" ? e.meta : (e.meta == null ? null : stringifyJson(e.meta)),
            e.createdAt || new Date().toISOString(),
          ]
        );
      }
      for (const topup of payload.paymentTopups || []) {
        if (!topup?.id || !topup?.userId || !topup?.invoiceNumber) continue;
        db.run(
          `INSERT OR REPLACE INTO paymentTopups(id, userId, invoiceNumber, sepayOrderId, sepayTransactionId, amountVnd, creditCents, status, paymentMethod, rawData, createdAt, paidAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            topup.id, topup.userId, topup.invoiceNumber, topup.sepayOrderId || null,
            topup.sepayTransactionId || null, Number(topup.amountVnd) || 0,
            Number(topup.creditCents) || 0, topup.status || "pending",
            topup.paymentMethod || null, typeof topup.rawData === "string" ? topup.rawData : (topup.rawData == null ? null : stringifyJson(topup.rawData)),
            topup.createdAt || new Date().toISOString(), topup.paidAt || null,
          ],
        );
      }
      for (const s of payload.userSettings || []) {
        if (!s?.userId) continue;
        db.run(
          `INSERT OR REPLACE INTO userSettings(userId, data) VALUES(?, ?)`,
          [s.userId, stringifyJson(s.data || {})],
        );
      }
      for (const identity of payload.externalIdentities || []) {
        if (!identity?.providerNamespace || !identity?.subject || !identity?.userId) continue;
        if (!db.get("SELECT id FROM users WHERE id = ?", [identity.userId])) continue;
        db.run(
          `INSERT OR REPLACE INTO externalIdentities(providerNamespace, subject, userId, createdAt) VALUES(?, ?, ?, ?)`,
          [identity.providerNamespace, identity.subject, identity.userId, identity.createdAt || new Date().toISOString()],
        );
      }
    }

    // Settings
    if (payload.settings) {
      db.run(`INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`, [stringifyJson(payload.settings)]);
    }

    for (const c of payload.providerConnections || []) {
      const { id, provider, authType, name, email, priority, isActive, createdAt, updatedAt, ...rest } = c;
      db.run(
        `INSERT OR REPLACE INTO providerConnections(id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, provider, authType || "oauth", name || null, email || null, priority || null, isActive === false ? 0 : 1, stringifyJson(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]
      );
    }
    for (const n of payload.providerNodes || []) {
      const { id, type, name, createdAt, updatedAt, ...rest } = n;
      db.run(
        `INSERT OR REPLACE INTO providerNodes(id, type, name, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`,
        [id, type || null, name || null, stringifyJson(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]
      );
    }
    for (const p of payload.proxyPools || []) {
      const { id, isActive, testStatus, createdAt, updatedAt, ...rest } = p;
      db.run(
        `INSERT OR REPLACE INTO proxyPools(id, isActive, testStatus, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`,
        [id, isActive === false ? 0 : 1, testStatus || "unknown", stringifyJson(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]
      );
    }
    for (const k of payload.apiKeys || []) {
      // Only keep an owner reference that actually resolves; a dangling FK would
      // abort the whole import, and a NULL owner is recoverable (admin re-claims it).
      const owner = k.ownerUserId
        ? db.get(`SELECT id FROM users WHERE id = ?`, [k.ownerUserId])?.id || null
        : null;
      db.run(
        `INSERT OR REPLACE INTO apiKeys(id, key, name, machineId, ownerUserId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [k.id, k.key, k.name || null, k.machineId || null, owner, k.isActive === false ? 0 : 1, k.createdAt || new Date().toISOString()]
      );
    }
    for (const c of payload.combos || []) {
      db.run(
        `INSERT OR REPLACE INTO combos(id, name, kind, modelProvider, models, thinkingMode, capabilityOverrides, disabledMembers, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.kind || null,
          c.modelProvider || null,
          stringifyJson(c.models || []),
          c.thinkingMode || "auto",
          stringifyJson(c.capabilityOverrides || {}),
          stringifyJson(c.disabledMembers || []),
          c.createdAt || new Date().toISOString(),
          c.updatedAt || new Date().toISOString(),
        ]
      );
    }
    for (const [a, m] of Object.entries(payload.modelAliases || {})) {
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('modelAliases', ?, ?)`, [a, stringifyJson(m)]);
    }
    for (const m of payload.customModels || []) {
      const k = `${m.providerAlias}|${m.id}|${m.type || "llm"}`;
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('customModels', ?, ?)`, [k, stringifyJson(m)]);
    }
    for (const model of payload.publishedModels || []) {
      if (!model?.comboId) continue;
      const { comboId, ...value } = model;
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('publishedModels', ?, ?)`, [comboId, stringifyJson(value)]);
    }
    if (Array.isArray(payload.modelProviders)) {
      for (const provider of payload.modelProviders) {
        if (!provider?.id || !provider?.name) continue;
        const { id, ...value } = provider;
        db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('modelProviders', ?, ?)`, [id, stringifyJson(value)]);
      }
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('modelProviders', '__initialized__', ?)`, [stringifyJson(true)]);
    }
    for (const [tool, mappings] of Object.entries(payload.mitmAlias || {})) {
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('mitmAlias', ?, ?)`, [tool, stringifyJson(mappings || {})]);
    }
    for (const [provider, models] of Object.entries(payload.pricing || {})) {
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('pricing', ?, ?)`, [provider, stringifyJson(models || {})]);
    }
    for (const [provider, models] of Object.entries(payload.disabledModels || {})) {
      db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES('disabledModels', ?, ?)`, [provider, stringifyJson(models || [])]);
    }
  });

  return await exportDb();
}

// Eager init helper (optional)
export async function initDb() {
  await getAdapter();
}
