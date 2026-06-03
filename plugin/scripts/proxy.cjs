#!/usr/bin/env node
/**
 * cc-statusline proxy server.
 * Lightweight DeepSeek proxy (port 13780).
 * Falls back to ds-hud's proxy if available.
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 13780;
const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const PID_FILE = path.join(CONFIG_DIR, "proxy.pid");
const STATS_FILE = path.join(CONFIG_DIR, "proxy-stats.json");
try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}

fs.writeFileSync(PID_FILE, String(process.pid));

let stats = { balance: null, cacheHitTokens: 0, requestCount: 0, balanceChange: 0, startTime: Date.now() };
try { stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8")); } catch {}

function saveStats() {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats));
}

function makeDeepSeekRequest(options, body, callback) {
  const req = https.request(
    { hostname: "api.deepseek.com", method: options.method, path: options.path, headers: options.headers, timeout: 120000 },
    (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const ct = res.headers["content-type"] || "";

        // Track usage
        if (res.headers["x-cache-hit-tokens"]) {
          stats.cacheHitTokens += parseInt(res.headers["x-cache-hit-tokens"], 10);
        }
        stats.requestCount++;
        saveStats();

        callback(res.statusCode, res.headers, body);
      });
    }
  );
  req.on("error", (e) => callback(502, {}, Buffer.from(JSON.stringify({ error: e.message }))));
  if (body) req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Stats API
  if (req.url === "/api/stats" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(stats));
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, uptime: Date.now() - stats.startTime }));
    return;
  }

  // Proxy to DeepSeek API
  let body = "";
  req.on("data", (c) => body += c);
  req.on("end", () => {
    const targetPath = req.url;

    // Forward headers, rewriting Authorization/API key
    const headers = { ...req.headers };
    delete headers.host;
    delete headers["content-length"];

    makeDeepSeekRequest(
      { method: req.method, path: targetPath, headers },
      body || undefined,
      (status, respHeaders, respBody) => {
        res.writeHead(status, respHeaders);
        res.end(respBody);
      }
    );
  });
});

server.listen(PORT, () => {
  process.stdout.write(`[proxy] listening on ${PORT}\n`);
});
