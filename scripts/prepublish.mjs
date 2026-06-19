#!/usr/bin/env node

/**
 * Prepublish script for 9router CLI package.
 * Builds Next.js standalone app and prepares the distributable package.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, "app");

console.log("🔨 Building 9router CLI package...\n");

// Step 1: Clean previous build
console.log("🧹 Cleaning previous build...");
if (existsSync(APP_DIR)) rmSync(APP_DIR, { recursive: true, force: true });

// Step 2: Install dependencies
console.log("📦 Installing dependencies...");
execSync("npm install", { cwd: ROOT, stdio: "inherit" });

// Step 3: Build Next.js
console.log("\n🏗️  Building Next.js standalone...");
execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

// Step 4: Verify standalone output
const standaloneDir = join(ROOT, ".next", "standalone");
if (!existsSync(join(standaloneDir, "server.js"))) {
  console.error("\n❌ Error: Standalone build not found at .next/standalone/server.js");
  console.error("   Make sure next.config.mjs has output: 'standalone'");
  process.exit(1);
}

// Step 5: Copy standalone to app/
console.log("\n📁 Copying standalone build to app/...");
cpSync(standaloneDir, APP_DIR, { recursive: true });

// Step 6: Copy static assets (required for Next.js standalone)
const staticDir = join(ROOT, ".next", "static");
const appStaticDir = join(APP_DIR, ".next", "static");
if (existsSync(staticDir)) {
  mkdirSync(dirname(appStaticDir), { recursive: true });
  cpSync(staticDir, appStaticDir, { recursive: true });
}

// Step 7: Copy public directory
const publicDir = join(ROOT, "public");
const appPublicDir = join(APP_DIR, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, appPublicDir, { recursive: true });
}

// Step 8: Fix hardcoded paths in server.js
console.log("🔧 Fixing hardcoded paths...");
const serverJsPath = join(APP_DIR, "server.js");
if (existsSync(serverJsPath)) {
  let content = readFileSync(serverJsPath, "utf-8");
  // Replace absolute build path with relative path
  content = content.replace(/ dirname\(__filename\) \+ '\/\.\.\//g, " dirname(__filename) + '/");
  writeFileSync(serverJsPath, content, "utf-8");
}

// Step 9: Create data directory
const dataDir = join(APP_DIR, "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Step 10: Verify final structure
console.log("\n✅ Verifying build...");
const requiredFiles = [
  join(APP_DIR, "server.js"),
];

let allGood = true;
for (const f of requiredFiles) {
  if (!existsSync(f)) {
    console.error(`❌ Missing: ${f}`);
    allGood = false;
  }
}

if (allGood) {
  console.log("\n🎉 Build complete! Package is ready for npm publish.");
} else {
  console.error("\n❌ Build incomplete. Some required files are missing.");
  process.exit(1);
}

console.log("\n🎉 Build complete! Package is ready for npm publish.");