#!/usr/bin/env node
/**
<<<<<<< HEAD
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
=======
 * cc-statusline: one-shot aggregator.
 * CC spawns fresh per render, writes JSON to stdin, closes it.
 * We read stdin, spawn claude-hud with JSON, capture output, run tests, merge.
>>>>>>> 4117026 (chore: cleanup continuous branch detour, finalize one-shot box)
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
=======
function resolveHud() {
  try {
    const cache = path.join(os.homedir(), ".claude", "plugins", "cache");
    for (const mp of fs.readdirSync(cache)) {
      const hd = path.join(cache, mp, "claude-hud");
      if (fs.existsSync(hd)) {
        const v = fs.readdirSync(hd).filter(d => /^\d/.test(d)).sort().reverse();
        if (v.length > 0) { const d = path.join(hd, v[0], "dist", "index.js"); if (fs.existsSync(d)) return d; }
>>>>>>> 4117026 (chore: cleanup continuous branch detour, finalize one-shot box)
      }
    }
  } catch {}
  return null;
}

<<<<<<< HEAD
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
=======
>>>>>>> 4117026 (chore: cleanup continuous branch detour, finalize one-shot box)
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

<<<<<<< HEAD
  // 3. Extra data as the last status line
  if (extraParts.length > 0) process.stdout.write(extraParts.join(" | ") + "\n");
>>>>>>> dbff258 (feat: one-shot stdin forwarding for continuous sources)
=======
  if (extra.length > 0) process.stdout.write(extra.join(" | ") + "\n");
>>>>>>> 4117026 (chore: cleanup continuous branch detour, finalize one-shot box)
}

main();
