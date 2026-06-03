#!/usr/bin/env node
/**
 * Test statusLine script 01.
 * Outputs "statusLine-01" with a simple counter.
 * Used to verify aggregation chaining works.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const COUNTER_FILE = path.join(os.homedir(), ".claude-statusline", "counter-01.txt");
let count = 0;
try { count = parseInt(fs.readFileSync(COUNTER_FILE, "utf8"), 10) || 0; } catch {}
count++;
fs.writeFileSync(COUNTER_FILE, String(count));

process.stdout.write(`⚡statusLine-01:${count}`);
