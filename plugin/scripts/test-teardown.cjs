#!/usr/bin/env node
/**
 * Remove test statusLine scripts (01 + 02) from the aggregation chain.
 * Run via /cc-statuslineTestUninstall
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");

function log(msg) { console.log(`[cc-statusline-test] ${msg}`); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function main() {
  const sources = readJson(SOURCES_FILE);
  if (!sources) {
    log("ERROR: sources.json not found. Nothing to clean.");
    process.exit(1);
  }

  const before = (sources.chains || []).length;
  sources.chains = (sources.chains || []).filter(c => c.label !== "test-01" && c.label !== "test-02");
  const removed = before - sources.chains.length;

  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + "\n");

  if (removed > 0) {
    log(`Removed ${removed} test script(s) from chain`);
  } else {
    log("No test scripts found in chain");
  }
}

main();
