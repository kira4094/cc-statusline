#!/usr/bin/env node
/**
 * cc-statusline installer.
 * Run once via /cc-statusline:setup skill.
 *
 * What it does:
 * 1. Reads settings.json
 * 2. Detects existing statusLine (claude-hud, ds-hud, etc.)
 * 3. Chains them into our sources.json
 * 4. Writes our statusLine command
 * 5. Writes Setup/SessionStart hooks (if not already from a plugin)
 * 6. Saves restore point
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const BACKUP_FILE = path.join(CONFIG_DIR, "settings-backup.json");

// Resolve our own absolute path (since we're in plugin cache)
const OUR_DIR = path.resolve(__dirname);
const OUR_STATUSLINE = path.join(OUR_DIR, "statusline.cjs");

try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}

// --- Helpers ---

function log(msg) { console.log(`[cc-statusline] ${msg}`); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// --- Main ---

function main() {
  log("=== cc-statusline installer ===");

  // 1. Read settings.json
  const settings = readJson(SETTINGS_PATH);
  if (!settings) {
    log("ERROR: Cannot read settings.json");
    process.exit(1);
  }

  // 2. Detect existing statusLine (save original BEFORE we modify)
  const existingStatusLine = settings.statusLine?.command || "";
  const chains = [];

  // Check if we already have a sources.json (re-run scenario)
  const existingSources = readJson(SOURCES_FILE);
  const previousStatusLine = existingSources?.previousStatusLine !== undefined
    ? existingSources.previousStatusLine
    : existingStatusLine;

  // Backup original settings only on first run
  if (!existingSources) {
    writeJson(BACKUP_FILE, settings);
    log("Settings backup saved (first install)");
  }

  if (existingStatusLine) {
    const knownLabels = {
      "claude-ds-hud": "ds-hud",
      "claude-hud": "claude-hud",
    };

    // Determine label
    let label = "unknown";
    for (const [key, val] of Object.entries(knownLabels)) {
      if (existingStatusLine.includes(key)) { label = val; break; }
    }

    // Only chain if it's not ourselves
    if (!existingStatusLine.includes("cc-statusline") && !existingStatusLine.includes("statusline.cjs")) {
      chains.push({
        label,
        path: existingStatusLine,
        command: existingStatusLine,
        detected: new Date().toISOString(),
      });
      log(`Chained existing statusLine: "${label}" → ${existingStatusLine}`);
    }
  } else {
    log("No existing statusLine found, will set fresh");
  }

  // 3. Also check hook-based statusLine (some tools use Setup hooks)
  const existingHooks = settings.hooks || {};
  if (existingHooks.Setup) {
    for (const entry of existingHooks.Setup) {
      if (entry.hooks) {
        for (const hook of entry.hooks) {
          if (hook.command && hook.command.includes("claude-hud") && !chains.find(c => c.command === hook.command)) {
            chains.push({
              label: "claude-hud",
              path: hook.command,
              command: hook.command,
              detected: new Date().toISOString(),
              source: "hook",
            });
            log(`Detected claude-hud in Setup hooks`);
          }
        }
      }
    }
  }

  // 4. Write sources.json (chaining config)
  const sources = {
    ourCommand: OUR_STATUSLINE,
    previousStatusLine,   // save original for uninstall restore
    chains,
    installedAt: new Date().toISOString(),
    version: "0.0.1",
  };
  writeJson(SOURCES_FILE, sources);
  log(`Sources saved: ${chains.length} chain(s)`);

  // 5. Set our statusLine in settings.json
  settings.statusLine = {
    type: "command",
    command: `node "${OUR_STATUSLINE}"`,
  };
  log(`statusLine set to: node "${OUR_STATUSLINE}"`);

  // 6. Write settings.json
  writeJson(SETTINGS_PATH, settings);
  log("settings.json updated successfully");

  // 7. Summary
  console.log("\n=== Summary ===");
  console.log(`  StatusLine: cc-statusline (chaining ${chains.length} source(s))`);
  if (chains.length) {
    console.log(`  Chained:`);
    for (const c of chains) {
      console.log(`    • ${c.label}: ${c.path}`);
    }
  }
  console.log(`  Aggregator: http://localhost:13781`);
  console.log(`  Proxy: http://localhost:13780`);
  console.log(`\nRun /reload-plugins to apply.`);
}

main();
