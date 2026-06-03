#!/usr/bin/env node
/**
 * cc-statusline uninstaller.
 * Run before uninstalling the plugin.
 *
 * What it does:
 * 1. Reads sources.json for previousStatusLine
 * 2. Restores the original statusLine if it existed
 * 3. Or removes our statusLine entry if none existed before
 * 4. Removes our hooks from settings.json
 * 5. Cleans up ~/.claude-statusline/
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const BACKUP_FILE = path.join(CONFIG_DIR, "settings-backup.json");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");

function log(msg) { console.log(`[cc-statusline] ${msg}`); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function main() {
  log("=== cc-statusline uninstaller ===");

  const settings = readJson(SETTINGS_PATH);
  if (!settings) {
    log("ERROR: Cannot read settings.json");
    process.exit(1);
  }

  const sources = readJson(SOURCES_FILE) || {};
  const backup = readJson(BACKUP_FILE);
  const prevCmd = sources.previousStatusLine || backup?.statusLine?.command || "";

  // 1. Restore or remove statusLine
  if (prevCmd && !prevCmd.includes("cc-statusline") && !prevCmd.includes("statusline.cjs")) {
    settings.statusLine = { type: "command", command: prevCmd };
    log(`Restored previous statusLine`);
  } else {
    delete settings.statusLine;
    log("Removed statusLine (none existed before install)");
  }

  // 2. Remove our hooks (Setup/SessionStart/PostToolUse that point to cc-statusline)
  const ourMarkers = ["cc-statusline", "statusline.cjs", "launcher.cjs", "collector.cjs"];
  if (settings.hooks) {
    for (const hookName of Object.keys(settings.hooks)) {
      settings.hooks[hookName] = settings.hooks[hookName].filter(entry => {
        if (!entry.hooks) return true;
        entry.hooks = entry.hooks.filter(h => {
          const cmd = h.command || "";
          return !ourMarkers.some(m => cmd.includes(m));
        });
        return entry.hooks.length > 0;
      }).filter(entry => entry.hooks.length > 0);

      if (settings.hooks[hookName].length === 0) {
        delete settings.hooks[hookName];
      }
    }
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  // 3. Clean up our config directory
  try {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
    log("Cleaned up ~/.claude-statusline/");
  } catch {}

  // 4. Write updated settings.json
  writeJson(SETTINGS_PATH, settings);
  log("settings.json restored");

  console.log("\n=== Done ===");
  console.log("Run /reload-plugins to apply.");
}

main();
