#!/usr/bin/env node
/**
 * cc-statusline: the box.
 *
 * Pure one-shot aggregator. Runs all chain sources, combines output, exits.
 * CC calls this on each statusLine refresh.
 */
const { execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const TIMEOUT = 5000;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

function runOneShot(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: TIMEOUT, stdio: ["pipe", "pipe", "ignore"], shell: true }).trim();
  } catch { return null; }
}

function httpGet(host, port, path) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path, timeout: 2000 }, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve(d));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const config = readConfig();
  const parts = [];

  // Run ALL chain sources (all are one-shot)
  for (const src of config.chains) {
    const cmd = src.command || `node "${src.path}"`;
    const out = runOneShot(cmd);
    if (out) parts.push(out);
  }

  // Aggregator API
  try {
    const raw = await httpGet("localhost", 13781, "/status");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.ds) parts.push(data.ds);
    }
  } catch {}

  if (parts.length > 0) process.stdout.write(parts.join(" | ") + "\n");
}

main();
