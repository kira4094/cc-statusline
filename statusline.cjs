#!/usr/bin/env node
/**
 * claude-statusline aggregator
 * Runs all scripts in ~/.claude/statusline/ and concatenates output.
 *
 * Conventions:
 * - Each script outputs ONE line to stdout (no trailing newline)
 * - Scripts run in filename sort order (00-, 01-, 02-...)
 * - If a script fails or times out, it's skipped silently
 * - Total time budget: 2000ms
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const os = require("os");

const STATUS_DIR = path.join(os.homedir(), ".claude", "statusline");
const TIMEOUT = 1500; // ms per script
const MAX_TOTAL = 2000; // ms total

function main() {
  if (!fs.existsSync(STATUS_DIR)) {
    return;
  }

  const files = fs.readdirSync(STATUS_DIR)
    .filter(f => f.endsWith(".cjs") || f.endsWith(".js"))
    .sort();

  if (files.length === 0) return;

  const outputs = [];
  const start = Date.now();

  for (const f of files) {
    if (Date.now() - start > MAX_TOTAL) break;

    const filePath = path.join(STATUS_DIR, f);
    const result = spawnSync(process.execPath, [filePath], {
      timeout: TIMEOUT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    if (result.status === 0 && result.stdout) {
      const text = result.stdout.toString().trim();
      if (text) outputs.push(text);
    }
    // stderr is silently ignored
  }

  if (outputs.length > 0) {
    console.log(outputs.join(" "));
  }
}

main();
