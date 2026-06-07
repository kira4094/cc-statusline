#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const STATUS_DIR = path.join(HOME, '.claude', 'statusline');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');

const PLUGIN_NAME = 'cc-statusline@cc-statusline';
const MARKETPLACE_KEY = 'cc-statusline';

function log(m) { console.log('[claude-statusline]', m); }
function warn(m) { console.error('[claude-statusline]', m); }

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function writeJSON(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

function cmdInstall() {
  // 1. Create data directory
  fs.mkdirSync(STATUS_DIR, { recursive: true });

  // 2. Register plugin in settings.json
  let s = readJSON(SETTINGS) || {};
  if (!s.enabledPlugins) s.enabledPlugins = {};
  s.enabledPlugins[PLUGIN_NAME] = true;
  if (!s.extraKnownMarketplaces) s.extraKnownMarketplaces = {};
  s.extraKnownMarketplaces[MARKETPLACE_KEY] = {
    source: { source: 'github', repo: 'kira4094/cc-statusline' }
  };
  writeJSON(SETTINGS, s);
  log('Plugin registered in settings.json');

  log('');
  log('Done! Restart Claude Code to activate the plugin,');
  log('then run "/cc-statuslineSetup" inside CC to deploy the aggregator.');
  log('');
  log('  IMPORTANT: The aggregator will NOT work without the setup step.');
}

function cmdUninstall(purge) {
  let s = readJSON(SETTINGS);
  if (s) {
    if (s.enabledPlugins) delete s.enabledPlugins[PLUGIN_NAME];
    if (s.extraKnownMarketplaces) delete s.extraKnownMarketplaces[MARKETPLACE_KEY];
    writeJSON(SETTINGS, s);
    log('Plugin unregistered from settings.json');
  }
  if (purge) {
    try { fs.rmSync(STATUS_DIR, { recursive: true, force: true }); log('Status scripts deleted'); } catch {}
  }
  log('Uninstall complete. Restart Claude Code,');
  log('then run "/cc-statuslineUninstall" inside CC to restore your previous statusLine.');
}

function cmdStatus() {
  if (!fs.existsSync(STATUS_DIR)) {
    log('Status directory not found');
    return;
  }
  const files = fs.readdirSync(STATUS_DIR).filter(f => f.endsWith('.cjs') || f.endsWith('.js')).sort();
  log(`Status scripts (${files.length}):`);
  for (const f of files) {
    log(`  ${f}`);
  }
  const settings = readJSON(SETTINGS);
  const sl = settings?.statusLine;
  if (sl) {
    log(`Current statusLine: ${sl.command?.slice(0, 80)}...`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`Usage: claude-statusline (npm: @kira4094/claude-statusline) <command>

Commands:
  install               Register cc-statusline plugin
  uninstall [--purge]   Unregister plugin and (with --purge) delete status scripts
  status                Show current status scripts
`);
    return;
  }
  switch (args[0]) {
    case 'install': cmdInstall(); break;
    case 'uninstall': cmdUninstall(args.includes('--purge')); break;
    case 'status': cmdStatus(); break;
    default: warn('Unknown command: ' + args[0]);
  }
}

main();
