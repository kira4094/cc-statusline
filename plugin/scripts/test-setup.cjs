#!/usr/bin/env node
/**
 * Add test statusLine scripts (01 + 02) to the aggregation chain.
 * Run via /cc-statuslineTestSetup
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const SCRIPTS_DIR = path.resolve(__dirname);
const now = new Date().toISOString();

function log(msg) { console.log(`[cc-statusline-test] ${msg}`); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function main() {
  const sources = readJson(SOURCES_FILE);
  if (!sources) {
    log("ERROR: sources.json not found. Run /cc-statuslineSetup first.");
    process.exit(1);
  }

  const existing = sources.chains || [];
  const labels = existing.map(c => c.label);

  const tests = [
    { label: "test-01", path: path.join(SCRIPTS_DIR, "statusline-01.cjs"), command: `node "${path.join(SCRIPTS_DIR, "statusline-01.cjs")}"` },
    { label: "test-02", path: path.join(SCRIPTS_DIR, "statusline-02.cjs"), command: `node "${path.join(SCRIPTS_DIR, "statusline-02.cjs")}"` },
  ];

  for (const t of tests) {
    if (labels.includes(t.label)) {
      log(`${t.label} already in chain, skipping`);
    } else {
      existing.push({ ...t, detected: now });
      log(`Added ${t.label} to chain`);
    }
  }

  sources.chains = existing;
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + "\n");

  console.log("\n=== Test chain ===");
  console.log(`  test-01: ⚡statusline-01:N (counter)`);
  console.log(`  test-02: 🔷statusline-02:HH:MM (timestamp)`);
  console.log(`\nRestart Claude Code or wait for statusLine refresh to see them.`);
}

main();
