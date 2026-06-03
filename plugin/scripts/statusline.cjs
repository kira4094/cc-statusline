#!/usr/bin/env node
/**
 * cc-statusline: continuous statusLine aggregator.
 * Runs as a long-lived process — CC reads stdout continuously.
 *
 * Chain source types:
 *   - one-shot:    runs and exits (test-01, test-02)
 *   - continuous:  spawned in background, captured to buffer (claude-hud)
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
const CONTINUOUS_SOURCES = new Set(["claude-hud", "ds-hud"]);

// ── Background daemon manager ──
const daemons = new Map(); // label -> { proc, buffer }

function startDaemon(src) {
  if (daemons.has(src.label)) return;
  const cmd = src.command || `node "${src.path}"`;
  const buffer = { lines: [] };

  try {
    const proc = spawn("bash", ["-c", cmd], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    proc.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      buffer.lines.push(...lines);
      if (buffer.lines.length > 10) buffer.lines = buffer.lines.slice(-5);
    });

    proc.stderr.on("data", () => {}); // silently discard

    proc.on("error", () => daemons.delete(src.label));
    proc.on("exit", () => daemons.delete(src.label));

    daemons.set(src.label, { proc, buffer });
  } catch {
    daemons.delete(src.label);
  }
}

function getDaemonOutput(label) {
  const d = daemons.get(label);
  if (!d || d.buffer.lines.length === 0) return null;

  // Capture the LATEST complete HUD output (last non-empty line)
  for (let i = d.buffer.lines.length - 1; i >= 0; i--) {
    const line = d.buffer.lines[i].trim();
    if (line && !line.startsWith("[claude-hud]") && !line.startsWith("Initializing")) {
      return line;
    }
  }
  return null;
}

function stopAllDaemons() {
  for (const [label, d] of daemons) {
    try { d.proc.kill(); } catch {}
  }
  daemons.clear();
}

// ── Config ──
function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

function httpGet(host, port, url) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: url, timeout: 2000 }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// ── Tick ──
async function tick() {
  const config = readConfig();
  const parts = [];

  for (const src of config.chains) {
    if (CONTINUOUS_SOURCES.has(src.label)) {
      // Continuous source: ensure daemon running, read buffer
      startDaemon(src);
      const out = getDaemonOutput(src.label);
      if (out) parts.push(out);
    } else {
      // One-shot source: run and capture output
      try {
        const cmd = src.command || `node "${src.path}"`;
        const out = execSync(cmd, {
          encoding: "utf8", timeout: ONESHOT_TIMEOUT,
          stdio: ["pipe", "pipe", "ignore"], shell: true,
        }).trim();
        if (out) parts.push(out);
      } catch {}
    }
  }

  // Aggregator API
  try {
    const raw = await httpGet("localhost", 13781, "/status");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.ds) parts.push(data.ds);
    }
  } catch {}

  const line = parts.join(" | ");
  if (line) process.stdout.write(line + "\n");
}

// ── Main ──
async function main() {
  await tick();
  setInterval(tick, TICK_MS);
  process.on("SIGTERM", () => { stopAllDaemons(); process.exit(0); });
  process.on("SIGINT", () => { stopAllDaemons(); process.exit(0); });
}

main().catch(() => process.stdout.write(""));
