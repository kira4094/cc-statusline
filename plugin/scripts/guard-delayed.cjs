#!/usr/bin/env node
/**
 * guard-delayed.cjs
 * Runs the guard 2 seconds after a reload to catch late register-statusline overwrites
 * from other plugins. This closes the gap between /reload-plugins and the next tool use.
 */
const { execSync } = require("child_process");
const path = require("path");

const LAUNCHER = path.join(__dirname, "launcher.cjs");

setTimeout(() => {
  try {
    execSync(`node "${LAUNCHER}" guard`, { stdio: "ignore", timeout: 5000 });
  } catch {
    // Silent — guard handles its own errors
  }
}, 2000);
