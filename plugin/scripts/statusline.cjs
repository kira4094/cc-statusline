#!/usr/bin/env node
/**
 * cc-statusline: the box.
 *
 * Forward stdin to continuous sources (claude-hud),
 * run one-shot sources on tick,
 * merge all outputs to stdout.
 */
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const TICK_MS = 3000;
const ONESHOT_TIMEOUT = 5000;
const CONTINUOUS_LABELS = new Set(["claude-hud", "ds-hud"]);

function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

// ── Resolve claude-hud dist path ──
function resolveClaudeHudPath() {
  try {
    const dirs = fs.readdirSync(path.join(os.homedir(), ".claude", "plugins", "cache"));
    for (const mp of dirs) {
      const hudDir = path.join(os.homedir(), ".claude", "plugins", "cache", mp, "claude-hud");
      if (fs.existsSync(hudDir)) {
        const versions = fs.readdirSync(hudDir).filter(d => /^\d/.test(d)).sort().reverse();
        if (versions.length > 0) {
          const dist = path.join(hudDir, versions[0], "dist", "index.js");
          if (fs.existsSync(dist)) return dist;
        }
      }
    }
  } catch {}
  return null;
}

// ── Continuous sources ──
const continuousProcs = [];
const daemonBuffers = [];

function launchContinuous(src) {
  const buf = { label: src.label, lines: [] };

  try {
    let proc;

    if (src.label === "claude-hud") {
      // Spawn node directly — no bash wrapper, avoids /dev/tty issues
      const distPath = resolveClaudeHudPath() || src.path;
      proc = spawn("node", [distPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, COLUMNS: "120" },
      });
    } else {
      const cmd = src.command || `node "${src.path}"`;
      proc = spawn("bash", ["-c", cmd], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, COLUMNS: "120" },
      });
    }

    proc.stdout.on("data", (d) => {
      const parts = d.toString().split("\n");
      for (const p of parts) {
        const t = p.trim();
        if (t && !t.startsWith("[claude-hud]") && !t.startsWith("Initializing")) {
          buf.lines.push(t);
        }
      }
      if (buf.lines.length > 30) buf.lines = buf.lines.slice(-10);
    });

    proc.stderr.on("data", () => {});
    proc.on("error", () => {});
    proc.on("exit", () => {
      const idx = daemonBuffers.indexOf(buf);
      if (idx >= 0) daemonBuffers.splice(idx, 1);
    });

    continuousProcs.push(proc);
    daemonBuffers.push(buf);
  } catch {}
}

// ── One-shot sources ──
function runOneShot(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: ONESHOT_TIMEOUT, stdio: ["pipe", "pipe", "ignore"], shell: true }).trim();
  } catch { return null; }
}

function httpGet(host, port, url) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: url, timeout: 2000 }, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve(d));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// ── Tick ──
function tick() {
  const config = readConfig();
  const parts = [];

  for (const buf of daemonBuffers) {
    if (buf.lines.length > 0) parts.push(buf.lines[buf.lines.length - 1]);
  }

  for (const src of config.chains) {
    if (CONTINUOUS_LABELS.has(src.label)) continue;
    const cmd = src.command || `node "${src.path}"`;
    const out = runOneShot(cmd);
    if (out) parts.push(out);
  }

  const line = parts.join(" | ");
  if (line) process.stdout.write(line + "\n");
}

// ── Main ──
const config = readConfig();

for (const src of config.chains) {
  if (CONTINUOUS_LABELS.has(src.label)) launchContinuous(src);
}

if (continuousProcs.length > 0) {
  process.stdin.on("data", (data) => {
    for (const p of continuousProcs) {
      try { p.stdin.write(data); } catch {}
    }
  });
  process.stdin.resume();
}

tick();
setInterval(tick, TICK_MS);

process.on("SIGTERM", () => { continuousProcs.forEach(p => { try { p.kill(); } catch {} }); process.exit(0); });
process.on("SIGINT", () => { continuousProcs.forEach(p => { try { p.kill(); } catch {} }); process.exit(0); });
