#!/usr/bin/env node
/**
 * cc-statusline: the box.
 *
 * Forwards stdin to continuous sources (claude-hud),
 * runs one-shot sources (test-01/02) on tick,
 * merges all outputs to stdout.
 */
const { spawn, execSync } = require("child_process");
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

// ── Launch continuous sources ──
const daemonBuffers = [];

function launchContinuous(src) {
  const cmd = src.command || `node "${src.path}"`;
  const buf = { label: src.label, lines: [] };

  try {
    const proc = spawn("bash", ["-c", cmd], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, COLUMNS: "120" },
    });

    proc.stdout.on("data", (d) => {
      const parts = d.toString().split("\n");
      for (const p of parts) {
        const t = p.trim();
        if (t) buf.lines.push(t);
      }
      if (buf.lines.length > 30) buf.lines = buf.lines.slice(-10);
    });

    proc.stderr.on("data", () => {});
    proc.on("error", () => {});
    proc.on("exit", () => {
      const idx = daemonBuffers.indexOf(buf);
      if (idx >= 0) daemonBuffers.splice(idx, 1);
    });

    // Forward stdin
    process.stdin.on("data", (data) => {
      try { proc.stdin.write(data); } catch {}
    });

    daemonBuffers.push(buf);
  } catch {}
}

function getContinuousOutput() {
  const parts = [];
  for (const buf of daemonBuffers) {
    // Take the latest non-junk line
    for (let i = buf.lines.length - 1; i >= 0; i--) {
      const l = buf.lines[i];
      if (l && !l.startsWith("[claude-hud]") && !l.startsWith("Initializing")) {
        parts.push(l);
        break;
      }
    }
  }
  return parts;
}

// ── One-shot sources ──
function runOneShot(src) {
  try {
    const cmd = src.command || `node "${src.path}"`;
    return execSync(cmd, {
      encoding: "utf8", timeout: ONESHOT_TIMEOUT,
      stdio: ["pipe", "pipe", "ignore"], shell: true,
    }).trim();
  } catch { return null; }
}

// ── Tick ──
function tick() {
  const config = readConfig();
  const parts = [];

  // Continuous
  parts.push(...getContinuousOutput());

  // One-shot
  for (const src of config.chains) {
    if (CONTINUOUS_LABELS.has(src.label)) continue;
    const out = runOneShot(src);
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

tick();
setInterval(tick, TICK_MS);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
