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
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const sourcesPath = path.join(CONFIG_DIR, "sources.json");
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const sl = settings.statusLine?.command || "";

      // 1. Restore statusLine if overwritten
      if (fs.existsSync(sourcesPath)) {
        const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
        const ourCmd = `node "${sources.ourCommand}"`;
        let changed = false;

        if (!sl.includes("cc-statusline") && !sl.includes("statusline.cjs") && sl !== ourCmd) {
          const chains = sources.chains || [];
          var gl = "chained";
          if (sl.indexOf("claude-hud")>=0) gl="claude-hud";
          else if (sl.indexOf("claude-ds-hud")>=0) gl="ds-hud";
          var gi = chains.findIndex(function(x){return x.command===sl||x.label===gl;});
          if (gi>=0) { chains[gi].command=sl; chains[gi].path=sl; }
          else { chains.push({label:gl,path:sl,command:sl,detected:new Date().toISOString()}); }
          sources.chains = chains;
          settings.statusLine = { type: "command", command: ourCmd };
          changed = true;
        }

        // 2. Auto-update chain paths when plugins version-bump
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
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
          fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
        }
      }
    } catch {}
  }
}

main();
