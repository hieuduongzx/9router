import { TABLES, buildCreateTableSql } from "../schema.js";
import { parseJson } from "../helpers/jsonCol.js";

// Per-account token-saver preferences. The first version snapshots the legacy
// global token-saver settings into every existing account so no request's
// effective behavior changes until an account edits its own copy.
const migration = {
  version: 5,
  name: "user-settings",
  up(db) {
    db.exec(buildCreateTableSql("userSettings", TABLES.userSettings));

    const row = db.get(`SELECT data FROM settings WHERE id = 1`);
    const raw = parseJson(row?.data, {});
    const snapshot = {
      rtkEnabled: raw.rtkEnabled !== false,
      headroomEnabled: raw.headroomEnabled === true,
      headroomUrl: raw.headroomUrl || "http://localhost:8787",
      headroomCompressUserMessages: raw.headroomCompressUserMessages === true,
      cavemanEnabled: raw.cavemanEnabled === true,
      cavemanLevel: raw.cavemanLevel || "full",
      ponytailEnabled: raw.ponytailEnabled === true,
      ponytailLevel: raw.ponytailLevel || "full",
      pxpipeEnabled: raw.pxpipeEnabled === true,
      pxpipeMinChars: Number.isFinite(Number(raw.pxpipeMinChars))
        ? Number(raw.pxpipeMinChars)
        : 25000,
      pxpipeTimeoutMs: Number.isFinite(Number(raw.pxpipeTimeoutMs))
        ? Number(raw.pxpipeTimeoutMs)
        : 15000,
    };
    const encoded = JSON.stringify(snapshot);
    for (const user of db.all(`SELECT id FROM users`)) {
      db.run(
        `INSERT OR REPLACE INTO userSettings(userId, data) VALUES(?, ?)`,
        [user.id, encoded],
      );
    }
  },
};

export default migration;
