#!/usr/bin/env node
/**
 * cc-statusline: main statusLine script.
 * Called by Claude Code's settings.json statusLine command.
 *
 * Outputs a single line combining:
 *   - Chained status lines from other tools (claude-hud, etc.)
 *   - DeepSeek proxy stats (balance, cache, requests)
 *   - cc-trace session/memory count
 *   - cc-rtk token savings
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(require("os").homedir(), ".claude-statusline");
const CONFIG_FILE = path.join(CONFIG_DIR, "sources.json");

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { return { chains: [] }; }
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

async function main() {
  const config = readConfig();
  const allParts = [];

  // 1. Chain other statusLine sources (claude-hud, ds-hud, etc.)
  for (const src of config.chains) {
    try {
      const { execSync } = require("child_process");
      const out = execSync(`node "${src.path}"`, { encoding: "utf8", timeout: 3000, stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (out) allParts.push(out);
    } catch {}
  }

  // 2. Poll aggregator API at :13781
  try {
    const raw = await httpGet("localhost", 13781, "/status");
    if (raw) {
      const data = JSON.parse(raw);
      const aggParts = [];
      if (data.ds) aggParts.push(data.ds);
      if (data.trace) aggParts.push(data.trace);
      if (data.rtk) aggParts.push(data.rtk);
      if (data.proxy) aggParts.push(data.proxy);
      if (aggParts.length) allParts.push(aggParts.join(" · "));
    }
  } catch {}

  process.stdout.write(allParts.join(" | "));
}

main().catch(() => process.stdout.write(""));
