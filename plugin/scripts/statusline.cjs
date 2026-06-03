#!/usr/bin/env node
/**
 * cc-statusline: multi-source statusLine aggregator (the box).
 *
 * CC's statusLine system:
 *   stdin  ← CC sends events
 *   stdout → CC displays
 *
 * This process:
 *   - Forwards stdin to continuous sources (claude-hud)
 *   - Runs one-shot sources (test-01/02) on tick
 *   - Merges all outputs into stdout for CC to display
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

// ── Read config ──
function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

// ── Launch all sources ──
const children = []; // { label, proc, buffer[] }

function launchSource(src) {
  const cmd = src.command || `node "${src.path}"`;
  const isContinuous = CONTINUOUS_LABELS.has(src.label);

  if (isContinuous) {
    // Continuous: spawn with stdin/stdout pipes
    const proc = spawn("bash", ["-c", cmd], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const buf = { label: src.label, lines: [] };

    proc.stdout.on("data", (data) => {
      const parts = data.toString().split("\n");
      for (const p of parts) {
        const t = p.trim();
        if (t) buf.lines.push(t);
      }
      if (buf.lines.length > 20) buf.lines = buf.lines.slice(-10);
    });

    proc.stderr.on("data", () => {}); // ignore

    proc.on("error", () => {});
    proc.on("exit", () => {
      const idx = children.indexOf(buf);
      if (idx >= 0) children.splice(idx, 1);
    });

    children.push(buf);
    return proc;
  }
  return null;
}

// ── Main ──
function main() {
  const config = readConfig();
  const continuousProcs = [];

  // Start all continuous sources
  for (const src of config.chains) {
    const p = launchSource(src);
    if (p) continuousProcs.push(p);
  }

  // Forward our stdin to all continuous processes
  if (continuousProcs.length > 0) {
    process.stdin.on("data", (data) => {
      for (const p of continuousProcs) {
        try { p.stdin.write(data); } catch {}
      }
    });
  }

  // Tick: collect outputs and write combined line
  function tick() {
    const parts = [];

    // Collect from continuous daemon buffers
    for (const buf of children) {
      const relevant = buf.lines.filter(
        (l) => !l.startsWith("[claude-hud]") && !l.startsWith("Initializing")
      );
      if (relevant.length > 0) {
        parts.push(relevant[relevant.length - 1]);
      }
    }

    // Run one-shot sources
    for (const src of config.chains) {
      if (CONTINUOUS_LABELS.has(src.label)) continue;
      try {
        const cmd = src.command || `node "${src.path}"`;
        const out = execSync(cmd, {
          encoding: "utf8", timeout: ONESHOT_TIMEOUT,
          stdio: ["pipe", "pipe", "ignore"], shell: true,
        }).trim();
        if (out) parts.push(out);
      } catch {}
    }

    if (parts.length > 0) {
      process.stdout.write(parts.join(" | ") + "\n");
    }
  }

  // First tick immediately
  tick();
  setInterval(tick, TICK_MS);

  // Cleanup on exit
  process.on("SIGTERM", () => {
    continuousProcs.forEach((p) => { try { p.kill(); } catch {} });
    process.exit(0);
  });
  process.on("SIGINT", () => {
    continuousProcs.forEach((p) => { try { p.kill(); } catch {} });
    process.exit(0);
  });
}

main();
