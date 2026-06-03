#!/usr/bin/env node
/**
 * cc-statusline aggregator server.
 * Runs at http://localhost:13781
 *
 * GET /status → combined JSON from all sources
 * GET /health → simple alive check
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 13781;
const PID_FILE = path.join(os.homedir(), ".claude-statusline", "aggregator.pid");
const DATA_FILE = path.join(os.homedir(), ".claude-statusline", "agg-data.json");

// Ensure config dir
const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}

// Write PID for launcher
fs.writeFileSync(PID_FILE, String(process.pid));

// --- Data collectors ---

async function fetchJson(url, timeout = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function collectDsStats() {
  // Poll proxy at :13780 for stats
  const data = await fetchJson("http://localhost:13780/api/stats");
  if (!data) return null;

  const parts = [];
  if (data.balance !== null && data.balance !== undefined) {
    parts.push(`¥${Number(data.balance).toFixed(2)}`);
  }
  if (data.cacheHitTokens > 0) {
    const v = data.cacheHitTokens >= 1e6
      ? (data.cacheHitTokens / 1e6).toFixed(1) + "M"
      : Math.round(data.cacheHitTokens / 1e3) + "k";
    parts.push(`HIT+${v}`);
  }
  if (data.requestCount > 0) parts.push(`req:${data.requestCount}`);

  return parts.length ? parts.join(" · ") : null;
}

async function collectTraceStats() {
  const data = await fetchJson("http://localhost:13779/api/status");
  if (!data) return null;

  const parts = [];
  if (data.sessionCount !== undefined) parts.push(`${data.sessionCount}ses`);
  if (data.memoryCount !== undefined) parts.push(`${data.memoryCount}mem`);
  return parts.length ? `trace:${parts.join("/")}` : null;
}

async function collectRtkStats() {
  const rtkFile = path.join(os.homedir(), ".rtk", "history.json");
  try {
    const raw = fs.readFileSync(rtkFile, "utf8");
    const hist = JSON.parse(raw);
    let saved = 0;
    if (Array.isArray(hist)) {
      for (const entry of hist) saved += entry.savedTokens || 0;
    }
    const v = saved >= 1e6 ? (saved / 1e6).toFixed(1) + "M" : Math.round(saved / 1e3) + "k";
    return `rtk:-${v}`;
  } catch {
    // Check if rtk binary is available
    try {
      require("child_process").execSync("rtk --version", { stdio: "ignore", timeout: 2000 });
      return "rtk:active";
    } catch {
      return null;
    }
  }
}

// --- HTTP Server ---

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/status") {
    const [ds, trace, rtk] = await Promise.all([
      collectDsStats(),
      collectTraceStats(),
      collectRtkStats(),
    ]);

    // Also read chain sources from sources.json
    let chains = [];
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "sources.json"), "utf8"));
      chains = cfg.chains || [];
    } catch {}

    const result = { ds, trace, rtk, chains: chains.map(c => c.label) };
    fs.writeFileSync(DATA_FILE, JSON.stringify(result));
    res.end(JSON.stringify(result));
  } else if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PORT, () => {
  process.stdout.write(`[aggregator] listening on ${PORT}\n`);
});
