#!/usr/bin/env node
/**
 * cc-statusline launcher.
 * Usage: node launcher.cjs <service>
 *   aggregator  → start/ping aggregator server at :13781
 *   proxy       → start/ping DeepSeek proxy at :13780
 *   guard       → check settings.json hasn't been overwritten
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const PID_DIR = path.join(CONFIG_DIR);
try { fs.mkdirSync(PID_DIR, { recursive: true }); } catch {}

const SERVICE = process.argv[2];

function pidFile(name) { return path.join(PID_DIR, `${name}.pid`); }

function isRunning(port) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: "localhost", port, path: "/health", timeout: 1000 }, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve(true));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function startService(name, script, port) {
  const pf = pidFile(name);
  // Check if already running
  try {
    const pid = parseInt(fs.readFileSync(pf, "utf8"), 10);
    try { process.kill(pid, 0); return; } catch {} // process exists, skip
  } catch {}

  const child = spawn("node", [script], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.unref();
  fs.writeFileSync(pf, String(child.pid));
}

async function main() {
  const scriptsDir = path.join(ROOT, "scripts");

  if (SERVICE === "aggregator") {
    const running = await isRunning(13781);
    if (!running) startService("aggregator", path.join(scriptsDir, "aggregator.cjs"), 13781);
  } else if (SERVICE === "proxy") {
    const running = await isRunning(13780);
    if (!running) {
      // Try ds-hud auto-start first, otherwise our own proxy
      try {
        execSync("node C:/Users/kiray/AppData/Roaming/npm/node_modules/claude-ds-hud/proxy/auto-start.cjs", { stdio: "ignore", timeout: 5000 });
      } catch {
        startService("proxy", path.join(scriptsDir, "proxy.cjs"), 13780);
      }
    }
  } else if (SERVICE === "guard") {
    // Check settings.json statusLine hasn't been overwritten
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const sl = settings.statusLine?.command || "";
      // If statusLine doesn't point to us, but the chain-sources config exists, we've been overwritten
      if (!sl.includes("cc-statusline") && !sl.includes("statusline.cjs")) {
        const sourcesPath = path.join(CONFIG_DIR, "sources.json");
        if (fs.existsSync(sourcesPath)) {
          const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
          if (sources.ourCommand && sl !== sources.ourCommand) {
            // Someone overwrote us (probably claude-hud). Fix it.
            // We chain the overwriter instead of losing our place.
            const chains = sources.chains || [];
            if (!chains.find(c => c.command === sl)) {
              chains.push({ label: "chained", path: sl, command: sl, detected: new Date().toISOString() });
            }
            sources.chains = chains;
            settings.statusLine = { type: "command", command: sources.ourCommand };
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
            fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
          }
        }
      }
    } catch {}
  }
}

main();
