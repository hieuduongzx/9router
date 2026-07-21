import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { getAdapter } from "../driver.js";

export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user",
});

const RECOVERY_ADMIN_IDENTITY = Object.freeze({
  username: "admin",
  email: "admin@localhost",
});

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CREDIT_ADJUSTMENT_CENTS = 100_000_000;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER,
    isActive: row.isActive === 1 || row.isActive === true,
    mustChangePassword: row.mustChangePassword === 1 || row.mustChangePassword === true,
    creditCents: Number.isSafeInteger(row.creditCents) ? row.creditCents : Number(row.creditCents) || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    creditCents: user.creditCents,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function validateUserProfileInput({ username, email }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return { error: "Username must be 3-32 characters and use only letters, numbers, dots, underscores, or hyphens." };
  }
  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  return { username: normalizedUsername, email: normalizedEmail };
}

export function validateRegistrationInput({ username, email, password }) {
  const validated = validateUserProfileInput({ username, email });
  if (validated.error) return validated;
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return { error: "Password must be 6-128 characters." };
  }

  return { ...validated, password };
}

function claimUnownedApiKeys(db, adminId) {
  if (!adminId) return;
  try {
    db.run("UPDATE apiKeys SET ownerUserId = ? WHERE ownerUserId IS NULL", [adminId]);
  } catch {
    // The ownership column is introduced by schema migration and may not exist during a rolling reload.
  }
}

export async function getPrimaryAdmin() {
  const db = await getAdapter();
  const admin = db.get(
    "SELECT * FROM users WHERE role = ? ORDER BY createdAt ASC LIMIT 1",
    [USER_ROLES.ADMIN]
  );
  claimUnownedApiKeys(db, admin?.id);
  return rowToUser(admin);
}

export async function getUserById(id) {
  if (!id) return null;
  const db = await getAdapter();
  return rowToUser(db.get("SELECT * FROM users WHERE id = ?", [id]));
}

export async function getUserByLogin(login) {
  const normalized = String(login || "").trim().toLowerCase();
  if (!normalized) return null;
  const db = await getAdapter();
  return rowToUser(db.get("SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE", [normalized, normalized]));
}

export async function createUser({ username, email, password, role = USER_ROLES.USER }) {
  const validated = validateRegistrationInput({ username, email, password });
  if (validated.error) throw new Error(validated.error);
  if (![USER_ROLES.ADMIN, USER_ROLES.USER].includes(role)) throw new Error("Invalid user role.");

  const db = await getAdapter();
  const passwordHash = await bcrypt.hash(validated.password, 12);
  let user = null;

  db.transaction(() => {
    if (db.get("SELECT id FROM users WHERE username = ? COLLATE NOCASE", [validated.username])) {
      const error = new Error("Username is already registered.");
      error.code = "USERNAME_EXISTS";
      throw error;
    }
    if (db.get("SELECT id FROM users WHERE email = ? COLLATE NOCASE", [validated.email])) {
      const error = new Error("Email is already registered.");
      error.code = "EMAIL_EXISTS";
      throw error;
    }

    const userCount = db.get("SELECT COUNT(*) AS count FROM users")?.count || 0;
    const now = new Date().toISOString();
    user = {
      id: randomUUID(),
      username: validated.username,
      email: validated.email,
      passwordHash,
      role: userCount === 0 ? USER_ROLES.ADMIN : role,
      isActive: true,
      mustChangePassword: false,
      creditCents: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.run(
      `INSERT INTO users(id, username, email, passwordHash, role, isActive, mustChangePassword, createdAt, updatedAt)
       VALUES(?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      [user.id, user.username, user.email, user.passwordHash, user.role, user.createdAt, user.updatedAt]
    );
    if (user.role === USER_ROLES.ADMIN) claimUnownedApiKeys(db, user.id);
  });

  return publicUser(user);
}

export async function listUsers() {
  const db = await getAdapter();
  return db.all("SELECT * FROM users ORDER BY createdAt ASC").map((row) => publicUser(rowToUser(row)));
}

export async function updateUserProfile(userId, { username, email }) {
  const validated = validateUserProfileInput({ username, email });
  if (validated.error) throw new Error(validated.error);

  const db = await getAdapter();
  let updated = null;
  db.transaction(() => {
    const target = rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId]));
    if (!target) return;
    if (db.get("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?", [validated.username, userId])) {
      const error = new Error("Username is already registered.");
      error.code = "USERNAME_EXISTS";
      throw error;
    }
    if (db.get("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?", [validated.email, userId])) {
      const error = new Error("Email is already registered.");
      error.code = "EMAIL_EXISTS";
      throw error;
    }
    if (target.username === validated.username && target.email === validated.email) {
      updated = publicUser(target);
      return;
    }

    const updatedAt = new Date().toISOString();
    db.run(
      "UPDATE users SET username = ?, email = ?, updatedAt = ? WHERE id = ?",
      [validated.username, validated.email, updatedAt, userId],
    );
    updated = publicUser(rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId])));
  });
  return updated;
}

export async function updateUserAccess(userId, { role, isActive }) {
  if (role !== undefined && !Object.values(USER_ROLES).includes(role)) {
    throw new Error("Invalid user role.");
  }
  const db = await getAdapter();
  let updated = null;
  db.transaction(() => {
    const target = rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId]));
    if (!target) return;
    const nextRole = role ?? target.role;
    const nextActive = isActive ?? target.isActive;
    const removesActiveAdmin = target.role === USER_ROLES.ADMIN
      && target.isActive
      && (nextRole !== USER_ROLES.ADMIN || !nextActive);
    if (removesActiveAdmin) {
      const remaining = db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?",
        [userId]
      );
      if (!remaining?.count) throw new Error("At least one active administrator is required.");
    }
    const updatedAt = new Date().toISOString();
    db.run(
      "UPDATE users SET role = ?, isActive = ?, updatedAt = ? WHERE id = ?",
      [nextRole, nextActive ? 1 : 0, updatedAt, userId]
    );
    updated = publicUser(rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId])));
  });
  return updated;
}

export async function adjustUserCredit(userId, adjustmentCents) {
  if (!Number.isSafeInteger(adjustmentCents) || adjustmentCents === 0) {
    throw new Error("Credit adjustment must be a non-zero whole number of cents.");
  }
  if (Math.abs(adjustmentCents) > MAX_CREDIT_ADJUSTMENT_CENTS) {
    throw new Error("Credit adjustment cannot exceed $1,000,000.00.");
  }

  const db = await getAdapter();
  let updated = null;
  db.transaction(() => {
    const target = rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId]));
    if (!target) return;
    const nextCreditCents = target.creditCents + adjustmentCents;
    if (nextCreditCents < 0) {
      throw new Error("Credit balance cannot be negative.");
    }

    const updatedAt = new Date().toISOString();
    db.run(
      "UPDATE users SET creditCents = ?, updatedAt = ? WHERE id = ?",
      [nextCreditCents, updatedAt, userId]
    );
    updated = publicUser(rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId])));
  });
  return updated;
}

export async function setUserCreditBalance(userId, creditCents) {
  if (!Number.isSafeInteger(creditCents) || creditCents < 0) {
    throw new Error("Credit balance must be a non-negative whole number of cents.");
  }
  if (creditCents > MAX_CREDIT_ADJUSTMENT_CENTS) {
    throw new Error("Credit balance cannot exceed $1,000,000.00.");
  }

  const db = await getAdapter();
  const updatedAt = new Date().toISOString();
  const result = db.run(
    "UPDATE users SET creditCents = ?, updatedAt = ? WHERE id = ?",
    [creditCents, updatedAt, userId]
  );
  if ((result?.changes ?? 0) === 0) return null;
  return publicUser(rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId])));
}

export async function deleteUserAccount(userId, actorUserId) {
  if (userId === actorUserId) throw new Error("You cannot delete your own account.");
  const db = await getAdapter();
  let deleted = false;
  db.transaction(() => {
    const target = rowToUser(db.get("SELECT * FROM users WHERE id = ?", [userId]));
    if (!target) return;
    if (target.role === USER_ROLES.ADMIN && target.isActive) {
      const remaining = db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?",
        [userId]
      );
      if (!remaining?.count) throw new Error("At least one active administrator is required.");
    }
    const result = db.run("DELETE FROM users WHERE id = ?", [userId]);
    deleted = (result?.changes ?? 0) > 0;
  });
  return deleted;
}

export async function verifyUserCredentials(login, password) {
  if (typeof password !== "string" || !password) return null;
  const user = await getUserByLogin(login);
  if (!user || !user.isActive) return null;
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}

export async function verifyUserPassword(userId, password) {
  if (typeof password !== "string" || !password) return false;
  const user = await getUserById(userId);
  if (!user || !user.isActive) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateUserPassword(userId, password, { mustChangePassword = false } = {}) {
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    throw new Error("Password must be 6-128 characters.");
  }
  const db = await getAdapter();
  const passwordHash = await bcrypt.hash(password, 12);
  const updatedAt = new Date().toISOString();
  const result = db.run(
    "UPDATE users SET passwordHash = ?, mustChangePassword = ?, updatedAt = ? WHERE id = ?",
    [passwordHash, mustChangePassword ? 1 : 0, updatedAt, userId]
  );
  return (result?.changes ?? 0) > 0;
}

export async function hasSecureAdminAccount() {
  const db = await getAdapter();
  const row = db.get("SELECT id FROM users WHERE role = 'admin' AND isActive = 1 AND mustChangePassword = 0 LIMIT 1");
  return !!row;
}

export async function resetRecoveryAdminCredentials() {
  const db = await getAdapter();
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const now = new Date().toISOString();
  const existing = db.get("SELECT id FROM users WHERE role = 'admin' ORDER BY createdAt ASC LIMIT 1");

  if (existing) {
    db.run(
      "UPDATE users SET passwordHash = ?, role = 'admin', isActive = 1, mustChangePassword = 1, updatedAt = ? WHERE id = ?",
      [passwordHash, now, existing.id]
    );
    return { user: publicUser(await getUserById(existing.id)), temporaryPassword };
  }

  const id = randomUUID();
  db.run(
    `INSERT INTO users(id, username, email, passwordHash, role, isActive, mustChangePassword, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, 'admin', 1, 1, ?, ?)`,
    [id, RECOVERY_ADMIN_IDENTITY.username, RECOVERY_ADMIN_IDENTITY.email, passwordHash, now, now]
  );
  return { user: publicUser(await getUserById(id)), temporaryPassword };
}
