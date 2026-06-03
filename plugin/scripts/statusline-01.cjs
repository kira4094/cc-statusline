#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const f = path.join(os.homedir(), ".claude-statusline", "counter-01.txt");
let count = 0;
try { count = parseInt(fs.readFileSync(f, "utf8"), 10) || 0; } catch {}
count++;
fs.writeFileSync(f, String(count));
process.stdout.write("⚡statusLine-01:" + count);
