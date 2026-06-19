#!/usr/bin/env node

const { spawn, exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");

function createSpinner(text) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let interval = null;
  let currentText = text;
  return {
    start() {
      if (process.stdout.isTTY) {
        process.stdout.write(`\r${frames[0]} ${currentText}`);
        interval = setInterval(() => {
          process.stdout.write(`\r${frames[i++ % frames.length]} ${currentText}`);
        }, 80);
      }
      return this;
    },
    stop() {
      if (interval) { clearInterval(interval); interval = null; }
      if (process.stdout.isTTY) { process.stdout.write("\r\x1b[K"); }
    },
    succeed(msg) { this.stop(); console.log(`✅ ${msg}`); },
    fail(msg) { this.stop(); console.log(`❌ ${msg}`); }
  };
}

const pkg = require("./package.json");
const args = process.argv.slice(2);

const APP_NAME = "9router";
const DEFAULT_PORT = 20129;
const DEFAULT_HOST = "0.0.0.0";

let port = DEFAULT_PORT;
let host = DEFAULT_HOST;
let noBrowser = false;
let skipUpdate = false;
let showLog = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") { port = parseInt(args[i + 1], 10) || DEFAULT_PORT; i++; }
  else if (args[i] === "--host" || args[i] === "-H") { host = args[i + 1] || DEFAULT_HOST; i++; }
  else if (args[i] === "--no-browser" || args[i] === "-n") { noBrowser = true; }
  else if (args[i] === "--log" || args[i] === "-l") { showLog = true; }
  else if (args[i] === "--skip-update") { skipUpdate = true; }
  else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Usage: ${APP_NAME} [options]

Options:
  -p, --port <port>   Port to run the server (default: ${DEFAULT_PORT})
  -H, --host <host>   Host to bind (default: ${DEFAULT_HOST})
  -n, --no-browser    Don't open browser automatically
  -l, --log           Show server logs (default: hidden)
  --skip-update       Skip auto-update check
  -h, --help          Show this help message
  -v, --version       Show version
`);
    process.exit(0);
  } else if (args[i] === "--version" || args[i] === "-v") {
    console.log(pkg.version);
    process.exit(0);
  }
}

const RUNTIME = process.execPath;

function compareVersions(a, b) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
}

function killAllAppProcesses() {
  return new Promise((resolve) => {
    try {
      const platform = process.platform;
      let pids = [];
      if (platform === "win32") {
        try {
          const output = execSync(`powershell -NonInteractive -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter 'Name=\\"node.exe\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`, { encoding: "utf8", windowsHide: true, timeout: 5000 });
          const lines = output.split("\n").slice(1).filter(l => l.trim());
          lines.forEach(line => {
            if (line.toLowerCase().includes("9router") || line.toLowerCase().includes("next-server")) {
              const match = line.match(/^"(\d+)"/);
              if (match && match[1] && match[1] !== process.pid.toString()) pids.push(match[1]);
            }
          });
        } catch (e) { /* no processes */ }
      } else {
        try {
          const output = execSync("ps aux 2>/dev/null", { encoding: "utf8", timeout: 5000 });
          output.split("\n").forEach(line => {
            if (line.includes("9router") || line.includes("next-server")) {
              const pid = line.trim().split(/\s+/)[1];
              if (pid && !isNaN(pid) && pid !== process.pid.toString()) pids.push(pid);
            }
          });
        } catch (e) { /* no processes */ }
      }
      if (pids.length > 0) {
        pids.forEach(pid => {
          try {
            if (platform === "win32") execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: "ignore", shell: true, windowsHide: true, timeout: 3000 });
            else execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 3000 });
          } catch (e) { /* already dead */ }
        });
        setTimeout(() => resolve(), 1000);
      } else { resolve(); }
    } catch (e) { resolve(); }
  });
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    try {
      const platform = process.platform;
      if (platform === "win32") {
        try {
          const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", shell: true, windowsHide: true, timeout: 5000 }).trim();
          const lines = output.split("\n").filter(l => l.includes("LISTENING"));
          if (lines.length > 0) {
            const pid = lines[0].trim().split(/\s+/).pop();
            execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: "ignore", shell: true, windowsHide: true, timeout: 3000 });
          }
        } catch (e) { /* port free */ }
      } else {
        try {
          const pidOutput = execSync(`lsof -ti:${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
          if (pidOutput) execSync(`kill -9 ${pidOutput.split("\n")[0]} 2>/dev/null`, { stdio: "ignore", timeout: 3000 });
        } catch (e) { /* port free */ }
      }
      setTimeout(() => resolve(), 500);
    } catch (e) { resolve(); }
  });
}

function checkForUpdate() {
  return new Promise((resolve) => {
    if (skipUpdate) { resolve(null); return; }
    const spinner = createSpinner("Checking for updates...").start();
    let resolved = false;
    const safetyTimeout = setTimeout(() => { if (!resolved) { resolved = true; spinner.stop(); resolve(null); } }, 8000);
    const done = (version) => { if (resolved) return; resolved = true; clearTimeout(safetyTimeout); spinner.stop(); resolve(version); };
    const req = https.get(`https://registry.npmjs.org/${pkg.name}/latest`, { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const latest = JSON.parse(data);
          if (latest.version && compareVersions(latest.version, pkg.version) > 0) done(latest.version);
          else done(null);
        } catch (e) { done(null); }
      });
    });
    req.on("error", () => done(null));
    req.on("timeout", () => { req.destroy(); done(null); });
  });
}

function performUpdate() {
  console.log(`\n🔄 Updating ${pkg.name}...\n`);
  try {
    const platform = process.platform;
    let shellCmd;
    if (platform === "win32") {
      const script = `
Write-Host "📥 Installing new version..."
npm cache clean --force 2>$null
npm install -g ${pkg.name}@latest --prefer-online 2>&1 | Out-Host
if ($LASTEXITCODE -eq 0) { Write-Host ""; Write-Host "✅ Update completed. Run '${pkg.name}' to start." }
else { Write-Host ""; Write-Host "❌ Update failed. Try manually: npm install -g ${pkg.name}@latest" }
Read-Host "Press Enter to continue"
`;
      const scriptPath = path.join(os.tmpdir(), `${APP_NAME}-update.ps1`);
      fs.writeFileSync(scriptPath, script);
      shellCmd = ["powershell.exe", ["-WindowStyle", "Normal", "-ExecutionPolicy", "Bypass", "-File", scriptPath]];
    } else {
      const script = `#!/bin/bash\necho "📥 Installing new version..."\nsleep 2\nnpm cache clean --force 2>/dev/null\nEXIT_CODE=1\nfor i in 1 2 3; do\n  npm install -g ${pkg.name}@latest --prefer-online 2>&1\n  EXIT_CODE=$?\n  [ $EXIT_CODE -eq 0 ] && break\n  echo "⏳ Retry $i/3..."\n  sleep 5\ndone\nif [ $EXIT_CODE -eq 0 ]; then echo ""; echo "✅ Update completed. Run '${pkg.name}' to start."; else echo ""; echo "❌ Update failed. Try manually: npm install -g ${pkg.name}@latest"; fi\n`;
      const scriptPath = path.join(os.tmpdir(), `${APP_NAME}-update.sh`);
      fs.writeFileSync(scriptPath, script, { mode: 0o755 });
      shellCmd = ["sh", [scriptPath]];
    }
    const child = spawn(shellCmd[0], shellCmd[1], { detached: true, stdio: "inherit", windowsHide: false });
    child.unref();
    process.exit(0);
  } catch (err) {
    console.error(`⚠️  Update failed: ${err.message}`);
    console.log(`   Run manually: npm install -g ${pkg.name}@latest\n`);
  }
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") cmd = `open "${url}"`;
  else if (platform === "win32") cmd = `start "" "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) console.log(`Open browser manually: ${url}`); });
}

// Find standalone server
const standaloneDir = path.join(__dirname, "app");
const serverPath = path.join(standaloneDir, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("Error: Standalone build not found.");
  console.error("Please run 'npm run build:cli' first.");
  process.exit(1);
}

// Start
checkForUpdate().then((latestVersion) => {
  return killAllAppProcesses().then(() => killProcessOnPort(port)).then(() => startServer(latestVersion));
});

const MAX_RESTARTS = 5;
const RESTART_RESET_MS = 30000;

function startServer(latestVersion) {
  const displayHost = host === DEFAULT_HOST ? "localhost" : host;
  const url = `http://${displayHost}:${port}/dashboard`;
  let restartCount = 0;
  let serverStartTime = Date.now();
  let isShuttingDown = false;

  function spawnServer() {
    serverStartTime = Date.now();
    return spawn(RUNTIME, [serverPath], {
      cwd: standaloneDir,
      stdio: showLog ? "inherit" : "ignore",
      detached: true,
      env: { ...process.env, PORT: port.toString(), HOSTNAME: host }
    });
  }

  let server = spawnServer();

  function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try { if (server.pid) process.kill(server.pid, "SIGKILL"); } catch (e) {}
    try { process.kill(-server.pid, "SIGKILL"); } catch (e) {}
  }

  process.on("SIGINT", () => { if (isShuttingDown) return; isShuttingDown = true; console.log("\nExiting..."); cleanup(); setTimeout(() => process.exit(0), 100); });
  process.on("SIGTERM", () => { if (isShuttingDown) return; isShuttingDown = true; cleanup(); setTimeout(() => process.exit(0), 100); });

  if (latestVersion) {
    console.log(`\n⬆️  New version available: v${latestVersion} (current: v${pkg.version})`);
    console.log(`   Run: npm install -g ${pkg.name}@latest\n`);
  }

  console.log(`\n🚀 ${APP_NAME} v${pkg.version}`);
  console.log(`   Server: http://${displayHost}:${port}`);
  console.log(`   Dashboard: ${url}\n`);

  if (!noBrowser) {
    setTimeout(() => openBrowser(url), 3000);
  }

  server.on("error", (err) => {
    console.error("Failed to start server:", err.message);
    if (!isShuttingDown) tryRestart();
    else { cleanup(); process.exit(1); }
  });

  server.on("close", (code) => {
    if (isShuttingDown || code === 0) { process.exit(code || 0); return; }
    tryRestart(code);
  });

  function tryRestart(code) {
    const aliveMs = Date.now() - serverStartTime;
    if (aliveMs >= RESTART_RESET_MS) restartCount = 0;
    if (restartCount >= MAX_RESTARTS) {
      console.error(`\n❌ Server crashed ${MAX_RESTARTS} times. Giving up.`);
      cleanup();
      process.exit(1);
      return;
    }
    restartCount++;
    const delay = Math.min(1000 * restartCount, 10000);
    console.error(`\n⚠️  Server exited (code=${code ?? "unknown"}). Restarting in ${delay / 1000}s... (${restartCount}/${MAX_RESTARTS})`);
    setTimeout(() => { server = spawnServer(); attachServerEvents(); }, delay);
  }

  function attachServerEvents() {
    server.on("error", (err) => {
      console.error("Failed to start server:", err.message);
      if (!isShuttingDown) tryRestart();
      else { cleanup(); process.exit(1); }
    });
    server.on("close", (code) => {
      if (isShuttingDown || code === 0) { process.exit(code || 0); return; }
      tryRestart(code);
    });
  }
}