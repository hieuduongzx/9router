#!/usr/bin/env node

/**
 * Postinstall script for 9router.
 * Rebuilds better-sqlite3 native module for the current platform.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, "app");

// The standalone app has its own node_modules
const APP_MODULES = path.join(APP_DIR, "node_modules");

console.log("🔧 Running 9router postinstall...");

// Rebuild better-sqlite3 if present
function rebuildNativeModule() {
  try {
    // Check if better-sqlite3 exists in the standalone app
    const bsSqlitePath = path.join(APP_MODULES, "better-sqlite3");
    if (fs.existsSync(bsSqlitePath)) {
      console.log("📦 Rebuilding better-sqlite3 for your platform...");
      execSync("npm rebuild better-sqlite3", {
        cwd: APP_DIR,
        stdio: "pipe",
        timeout: 120000,
      });
      console.log("✅ better-sqlite3 rebuilt successfully.");
    }
  } catch (err) {
    // Try rebuilding from the root as fallback
    try {
      console.log("⚠️  Attempting fallback rebuild from root...");
      execSync("npm rebuild better-sqlite3", {
        cwd: ROOT,
        stdio: "pipe",
        timeout: 120000,
      });

      // Copy rebuilt module into app/node_modules
      const rootBsSqlite = path.join(ROOT, "node_modules", "better-sqlite3");
      if (fs.existsSync(rootBsSqlite) && fs.existsSync(APP_MODULES)) {
        console.log("📦 Copying rebuilt module to app...");
        cpDirSync(rootBsSqlite, path.join(APP_MODULES, "better-sqlite3"));
        console.log("✅ Module copied.");
      }
    } catch (fallbackErr) {
      console.log("⚠️  Could not rebuild better-sqlite3. The app will use sql.js (WASM) as fallback.");
    }
  }
}

function cpDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) cpDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

rebuildNativeModule();
console.log("✅ 9router postinstall complete.\n");