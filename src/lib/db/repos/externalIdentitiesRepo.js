import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { getAdapter } from "../driver.js";
import { getUserById, publicUser, USER_ROLES } from "./usersRepo.js";

function normalizeIdentity(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`External identity ${label} is required`);
  return normalized;
}

export async function getUserByExternalIdentity(providerNamespace, subject) {
  const provider = normalizeIdentity(providerNamespace, "provider namespace");
  const stableSubject = normalizeIdentity(subject, "subject");
  const db = await getAdapter();
  const binding = db.get(
    "SELECT userId FROM externalIdentities WHERE providerNamespace = ? AND subject = ?",
    [provider, stableSubject],
  );
  return binding ? getUserById(binding.userId) : null;
}

export async function resolveOrProvisionExternalIdentity(providerNamespace, subject, { usernamePrefix } = {}) {
  const provider = normalizeIdentity(providerNamespace, "provider namespace");
  const stableSubject = normalizeIdentity(subject, "subject");
  const prefix = String(usernamePrefix || provider.split(":", 1)[0] || "sso")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 12) || "sso";
  const db = await getAdapter();
  const existing = await getUserByExternalIdentity(provider, stableSubject);
  if (existing) return publicUser(existing);
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let userId;
    try {
      db.transaction(() => {
        const existing = db.get(
          "SELECT userId FROM externalIdentities WHERE providerNamespace = ? AND subject = ?",
          [provider, stableSubject],
        );
        if (existing) {
          userId = existing.userId;
          return;
        }

        const suffix = randomBytes(12).toString("hex");
        userId = randomUUID();
        const now = new Date().toISOString();
        db.run(
          `INSERT INTO users(id, username, email, passwordHash, role, isActive, mustChangePassword, creditCents, createdAt, updatedAt)
           VALUES(?, ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
          [userId, `${prefix}_${suffix}`, `${prefix}-${suffix}@identity.local`, passwordHash, USER_ROLES.USER, now, now],
        );
        db.run(
          "INSERT INTO externalIdentities(providerNamespace, subject, userId, createdAt) VALUES(?, ?, ?, ?)",
          [provider, stableSubject, userId, now],
        );
      });
      return publicUser(await getUserById(userId));
    } catch (error) {
      const existing = await getUserByExternalIdentity(provider, stableSubject);
      if (existing) return publicUser(existing);
      if (!/UNIQUE|constraint/i.test(String(error?.message || "")) || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to provision external identity");
}
