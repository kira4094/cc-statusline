#!/usr/bin/env node
/**
 * cc-statusline: the box.
 *
 * Forward stdin to continuous sources (claude-hud),
 * run one-shot sources (test-01/02) on tick,
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

// ── Continuous sources (claude-hud) ──
const continuousProcs = [];
const daemonBuffers = [];

function launchContinuous(src) {
  const cmd = src.command || `node "${src.path}"`;

  try {
    const proc = spawn("bash", ["-c", cmd], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, COLUMNS: "120" },
    });

    const buf = { label: src.label, lines: [] };

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

// ── One-shot sources (test-01, test-02) ──
function runOneShot(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: ONESHOT_TIMEOUT, stdio: ["pipe", "pipe", "ignore"], shell: true }).trim();
  } catch { return null; }
}

function httpGet(host, port, url) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: url, timeout: 2000 }, (res) => {
      let d = "";
      res.on("d", (c) => d += c);
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

  // Continuous: latest line from each daemon buffer
  for (const buf of daemonBuffers) {
    if (buf.lines.length > 0) parts.push(buf.lines[buf.lines.length - 1]);
  }

  // One-shot
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

// Start continuous sources
for (const src of config.chains) {
  if (CONTINUOUS_LABELS.has(src.label)) launchContinuous(src);
}

// Forward stdin to all continuous processes
if (continuousProcs.length > 0) {
  process.stdin.on("data", (data) => {
    for (const p of continuousProcs) {
      try { p.stdin.write(data); } catch {}
    }
  });
  process.stdin.resume();
}

// First tick immediately
tick();
setInterval(tick, TICK_MS);

process.on("SIGTERM", () => { continuousProcs.forEach(p => { try { p.kill(); } catch {} }); process.exit(0); });
process.on("SIGINT", () => { continuousProcs.forEach(p => { try { p.kill(); } catch {} }); process.exit(0); });
