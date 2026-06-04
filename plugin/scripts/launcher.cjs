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

function deriveIdentity(cmd) {
  // Extract stable plugin identity from paths like:
  //   ...plugins/cache/<market>/<name>/<version>/...
  // Returns "plugin:<market>/<name>" or null for non-plugin commands
  const m = cmd.match(/plugins[/\\]cache[/\\]([^/\\]+)[/\\]([^/\\]+)[/\\]/);
  if (m) return `plugin:${m[1]}/${m[2]}`;
  return null;
}

async function main() {
  const scriptsDir = path.join(ROOT, "scripts");

  if (SERVICE === "aggregator") {
    const running = await isRunning(13781);
    if (!running) startService("aggregator", path.join(scriptsDir, "aggregator.cjs"), 13781);
  } else if (SERVICE === "proxy") {
    const running = await isRunning(13780);
    if (!running) {
      startService("proxy", path.join(scriptsDir, "proxy.cjs"), 13780);
    }
  } else if (SERVICE === "guard") {
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const sourcesPath = path.join(CONFIG_DIR, "sources.json");
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const sl = settings.statusLine?.command || "";

      if (fs.existsSync(sourcesPath)) {
        const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
        const ourCmd = `node "${sources.ourCommand}"`;
        let changed = false;

        // 0. Migrate: fill missing identity for old chains
        for (const ch of (sources.chains || [])) {
          if (!ch.identity && ch.command) {
            const id = deriveIdentity(ch.command);
            if (id) { ch.identity = id; changed = true; }
          }
        }

        // 1. Restore statusLine if overwritten — identity-based dedup
        if (!sl.includes("cc-statusline") && sl !== ourCmd) {
          const chains = sources.chains || [];
          const incomingId = deriveIdentity(sl);
          const existingIdx = incomingId
            ? chains.findIndex(c => c.identity === incomingId)
            : chains.findIndex(c => c.command === sl);

          if (existingIdx === -1) {
            // New plugin — chain it
            chains.push({
              label: "chained",
              path: sl,
              command: sl,
              identity: incomingId || undefined,
              detected: new Date().toISOString()
            });
          } else {
            // Same plugin, new version — update path, don't duplicate
            const existing = chains[existingIdx];
            if (existing.command !== sl) {
              existing.path = sl;
              existing.command = sl;
              existing.detected = new Date().toISOString();
              if (incomingId) existing.identity = incomingId;
            }
          }
          sources.chains = chains;
          settings.statusLine = { type: "command", command: ourCmd };
          changed = true;
        }

        // 2. Version-bump update for remaining chains
        for (let ci = 0; ci < (sources.chains || []).length; ci++) {
          const ch = sources.chains[ci];
          if (!ch.path) continue;
          const segs = ch.path.replace(/\\/g, "/").split("/");
          let verIdx = -1;
          for (let si = 0; si < segs.length; si++) {
            if (/^v?\d+\.\d+/.test(segs[si])) { verIdx = si; break; }
          }
          if (verIdx < 1) continue;
          const parent = segs.slice(0, verIdx).join("/");
          const scriptPath = segs.slice(verIdx + 1).join("/");
          let versions;
          try { versions = fs.readdirSync(parent).filter(d => /^v?\d/.test(d)).sort().reverse(); } catch { continue; }
          if (versions.length > 0 && versions[0] !== segs[verIdx]) {
            const newPath = parent + "/" + versions[0] + "/" + scriptPath;
            if (fs.existsSync(newPath)) {
              ch.path = newPath;
              ch.command = 'node "' + newPath + '"';
              changed = true;
            }
          }
        }

        if (changed) {
          const stmp = settingsPath + ".tmp." + process.pid;
          fs.writeFileSync(stmp, JSON.stringify(settings, null, 2) + "\n");
          fs.renameSync(stmp, settingsPath);
          const sotmp = sourcesPath + ".tmp." + process.pid;
          fs.writeFileSync(sotmp, JSON.stringify(sources, null, 2) + "\n");
          fs.renameSync(sotmp, sourcesPath);
        }
      }
    } catch {}
  }
}

main();
