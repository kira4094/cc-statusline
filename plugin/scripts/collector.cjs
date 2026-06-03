#!/usr/bin/env node
/**
 * cc-statusline collector.
 * PostToolUse hook — quick stats snapshot written to data file.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_FILE = path.join(os.homedir(), ".claude-statusline", "last-collect.json");
const data = { ts: Date.now() };

// Read cc-trace status
try {
  const http = require("http");
  const raw = fs.readFileSync(path.join(os.homedir(), ".claude-statusline", "agg-data.json"), "utf8");
  if (raw) Object.assign(data, JSON.parse(raw));
} catch {}

fs.writeFileSync(DATA_FILE, JSON.stringify(data));
