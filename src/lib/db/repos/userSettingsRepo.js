import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const DEFAULT_HEADROOM_URL = process.env.HEADROOM_URL || "http://localhost:8787";

// Per-account token-saver preferences. Each account owns its own copy; the
// global settings row keeps the legacy/machine-level keys (headroom extras
// activation, pxpipe auto-install) that are host-wide concerns.
export const DEFAULT_USER_TOKEN_SAVER_SETTINGS = {
  rtkEnabled: true,
  headroomEnabled: false,
  headroomUrl: DEFAULT_HEADROOM_URL,
  headroomCompressUserMessages: false,
  cavemanEnabled: false,
  cavemanLevel: "full",
  ponytailEnabled: false,
  ponytailLevel: "full",
  pxpipeEnabled: false,
  pxpipeMinChars: 25000,
  pxpipeTimeoutMs: 15000,
};

function mergeUserSettings(raw) {
  return { ...DEFAULT_USER_TOKEN_SAVER_SETTINGS, ...(raw || {}) };
}

async function readRaw(userId) {
  const db = await getAdapter();
  const row = db.get(`SELECT data FROM userSettings WHERE userId = ?`, [userId]);
  return row ? parseJson(row.data, {}) : {};
}

/** Resolve an account's token-saver settings, merged with hard defaults. */
export async function getUserTokenSaverSettings(userId) {
  if (!userId) return { ...DEFAULT_USER_TOKEN_SAVER_SETTINGS };
  const raw = await readRaw(userId);
  return mergeUserSettings(raw);
}

/** Generic alias so future per-account preference keys can live in the same row. */
export async function getUserSettings(userId) {
  return getUserTokenSaverSettings(userId);
}

/** Atomic read-merge-write of one account's preferences. Returns the merged copy. */
export async function updateUserSettings(userId, updates) {
  if (!userId) throw new Error("User id required to update per-account settings.");
  const db = await getAdapter();
  let next;
  db.transaction(function () {
    const row = db.get(`SELECT data FROM userSettings WHERE userId = ?`, [userId]);
    const current = row ? parseJson(row.data, {}) : {};
    next = mergeUserSettings({ ...current, ...(updates || {}) });
    db.run(
      `INSERT INTO userSettings(userId, data) VALUES(?, ?) ON CONFLICT(userId) DO UPDATE SET data = excluded.data`,
      [userId, stringifyJson(next)],
    );
  });
  return next;
}
