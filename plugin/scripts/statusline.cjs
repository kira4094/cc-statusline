#!/usr/bin/env node
/**
 * cc-statusline: one-shot aggregator.
 * CC spawns fresh per render, writes JSON to stdin, closes it.
 * We pipe JSON to all chained sources, collect outputs, merge.
 */
const { execSync } = require("child_process");
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


function readStdin() {
  return new Promise((resolve) => {
    const c = [];
    process.stdin.on("data", (d) => c.push(d));
    process.stdin.on("end", () => resolve(Buffer.concat(c).toString()));
    setTimeout(() => resolve(c.length > 0 ? Buffer.concat(c).toString() : ""), 500);
  });
}


async function main() {
  const json = await readStdin();
  const config = readConfig();
  let outputs = [];

  // cc-statusline indicator (golden)
  const R = "\x1b[38;2;255;185;15m[↪▨]\x1b[0m ";

  // Run all chain sources — JSON piped to all, non-readers ignore it
  for (const src of config.chains) {
    try {
      const cmd = src.command || 'node "' + src.path + '"';
      const o = execSync(cmd, {
        encoding: "utf8",
        timeout: ONESHOT_TIMEOUT,
        input: json,
        stdio: ["pipe", "pipe", "ignore"],
        shell: true,
      }).trim();
      if (o) outputs.push(o);
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
    if (raw) { const d = JSON.parse(raw); if (d.ds) outputs.push(d.ds); }
  } catch {}

  if (outputs.length > 0) {
    process.stdout.write(R + outputs.join(" | ") + "\n");
  }
}

main();
