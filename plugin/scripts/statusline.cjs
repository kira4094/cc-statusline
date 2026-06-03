#!/usr/bin/env node
/**
<<<<<<< HEAD
 * cc-statusline: one-shot aggregator.
 * CC spawns fresh per render, writes JSON to stdin, closes it.
 * We read stdin, spawn claude-hud with JSON, capture output, run tests, merge.
=======
 * cc-statusline: the box.
 *
 * CC pipes JSON session data to stdin on each render.
 * We read stdin, forward to claude-hud (continuous daemon),
 * run one-shot sources, merge all outputs to stdout.
>>>>>>> dbff258 (feat: one-shot stdin forwarding for continuous sources)
 */
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const ONESHOT_TIMEOUT = 5000;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

<<<<<<< HEAD
function resolveHud() {
  try {
    const cache = path.join(os.homedir(), ".claude", "plugins", "cache");
    for (const mp of fs.readdirSync(cache)) {
      const hd = path.join(cache, mp, "claude-hud");
      if (fs.existsSync(hd)) {
        const v = fs.readdirSync(hd).filter(d => /^\d/.test(d)).sort().reverse();
        if (v.length > 0) { const d = path.join(hd, v[0], "dist", "index.js"); if (fs.existsSync(d)) return d; }
=======
function resolveClaudeHudPath() {
  try {
    const cacheDir = path.join(os.homedir(), ".claude", "plugins", "cache");
    for (const mp of fs.readdirSync(cacheDir)) {
      const hudDir = path.join(cacheDir, mp, "claude-hud");
      if (fs.existsSync(hudDir)) {
        const versions = fs.readdirSync(hudDir).filter(d => /^\d/.test(d)).sort().reverse();
        if (versions.length > 0) {
          const dist = path.join(hudDir, versions[0], "dist", "index.js");
          if (fs.existsSync(dist)) return dist;
        }
>>>>>>> dbff258 (feat: one-shot stdin forwarding for continuous sources)
      }
    }
  } catch {}
  return null;
}

<<<<<<< HEAD
function readStdin() {
  return new Promise((resolve) => {
    const c = [];
    process.stdin.on("data", (d) => c.push(d));
    process.stdin.on("end", () => resolve(Buffer.concat(c).toString()));
    setTimeout(() => resolve(c.length > 0 ? Buffer.concat(c).toString() : ""), 500);
  });
}

function runHud(json) {
  return new Promise((resolve) => {
    const dp = resolveHud();
    if (!dp) { resolve(""); return; }
    const p = spawn("node", [dp], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, COLUMNS: "120" } });
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.stderr.on("data", () => {});
    if (json) p.stdin.write(json);
    p.stdin.end();
    setTimeout(() => {
      try { p.kill(); } catch {}
      const lines = out.split("\n").filter(l => { const t = l.trim(); return t && !t.startsWith("[claude-hud]") && !t.startsWith("Initializing"); });
      resolve(lines.join("\n"));
    }, 2000);
  });
}

async function main() {
  const json = await readStdin();
  const config = readConfig();
  let extra = [];

  // claude-hud
  for (const src of config.chains) {
    if (src.label === "claude-hud" || src.label === "ds-hud") {
      const hud = await runHud(json);
      if (hud) process.stdout.write(hud + "\n");
    }
  }

  // One-shot sources
  for (const src of config.chains) {
    if (["claude-hud","ds-hud"].includes(src.label)) continue;
    try {
      const cmd = src.command || 'node "' + src.path + '"';
      const o = execSync(cmd, { encoding: "utf8", timeout: ONESHOT_TIMEOUT, stdio: ["pipe","pipe","ignore"], shell: true }).trim();
      if (o) extra.push(o);
    } catch {}
  }

  // Aggregator
  try {
    const raw = await new Promise((resolve) => {
      const r = http.get({ hostname: "localhost", port: 13781, path: "/status", timeout: 2000 }, (res) => {
        let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve(d));
      });
      r.on("error", () => resolve(null)); r.on("timeout", () => { r.destroy(); resolve(null); });
    });
    if (raw) { const d = JSON.parse(raw); if (d.ds) extra.push(d.ds); }
  } catch {}

  if (extra.length > 0) process.stdout.write(extra.join(" | ") + "\n");
=======
// Read ALL stdin from CC (JSON payload)
function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString()));
    // Also resolve on next tick if stdin has no data (safety)
    setTimeout(() => {
      if (chunks.length === 0) resolve("");
    }, 100);
  });
}

// Run claude-hud with the JSON payload as stdin, capture output
function runClaudeHud(ccJson) {
  return new Promise((resolve) => {
    const distPath = resolveClaudeHudPath();
    if (!distPath) { resolve(null); return; }

    const proc = spawn("node", [distPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, COLUMNS: "120" },
    });

    let output = "";

    proc.stdout.on("data", (d) => {
      const text = d.toString();
      output += text;
    });

    proc.stderr.on("data", () => {});

    // Send CC's JSON to claude-hud's stdin, then close it
    if (ccJson) {
      proc.stdin.write(ccJson);
    }
    proc.stdin.end();

    // Wait for output, then kill
    setTimeout(() => {
      try { proc.kill(); } catch {}
      // Return ALL non-junk lines (claude-hud outputs 2+ HUD lines)
      const lines = output.split("\n").filter(l => {
        const t = l.trim();
        return t && !t.startsWith("[claude-hud]") && !t.startsWith("Initializing");
      });
      resolve(lines.length > 0 ? lines.join("\n") : null);
    }, 2000);
  });
}

function runOneShot(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: ONESHOT_TIMEOUT, stdio: ["pipe", "pipe", "ignore"], shell: true }).trim();
  } catch { return null; }
}

async function httpGet(host, port, url) {
  try {
    const raw = await new Promise((resolve) => {
      const req = http.get({ hostname: host, port, path: url, timeout: 2000 }, (res) => {
        let d = "";
        res.on("data", (c) => d += c);
        res.on("end", () => resolve(d));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    });
    if (raw) {
      const data = JSON.parse(raw);
      if (data.ds) return data.ds;
    }
  } catch {}
  return null;
}

async function main() {
  // 1. Read CC's JSON from stdin
  const ccJson = await readStdin();

  // 2. Run all sources
  const config = readConfig();
  const extraParts = [];

  // claude-hud with CC JSON — output all HUD lines directly
  for (const src of config.chains) {
    if (src.label === "claude-hud" || src.label === "ds-hud") {
      const hud = await runClaudeHud(ccJson);
      if (hud) process.stdout.write(hud + "\n");  // all HUD lines
    }
  }

  // One-shot sources — collected as extra line
  for (const src of config.chains) {
    if (CONTINUOUS_LABELS.has(src.label)) continue;
    const cmd = src.command || `node "${src.path}"`;
    const out = runOneShot(cmd);
    if (out) extraParts.push(out);
  }

  // Aggregator API
  const agg = await httpGet("localhost", 13781, "/status");
  if (agg) extraParts.push(agg);

  // 3. Extra data as the last status line
  if (extraParts.length > 0) process.stdout.write(extraParts.join(" | ") + "\n");
>>>>>>> dbff258 (feat: one-shot stdin forwarding for continuous sources)
}

main();
