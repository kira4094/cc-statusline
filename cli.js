#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const HOME = os.homedir();
const STATUS_DIR = path.join(HOME, '.claude', 'statusline');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const AGGREGATOR_SRC = path.join(__dirname, 'statusline.cjs');
const AGGREGATOR_DST = path.join(STATUS_DIR, 'aggregator.cjs');

function log(m) { console.log('[claude-statusline]', m); }
function warn(m) { console.error('[claude-statusline]', m); }

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJSON(p, o) {
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n');
}

function cmdInstall() {
  fs.mkdirSync(STATUS_DIR, { recursive: true });

  // 1. Backup existing statusLine
  const settings = readJSON(SETTINGS) || {};
  const existing = settings.statusLine;
  if (existing) {
    const backupPath = path.join(STATUS_DIR, '00-user.cjs');
    // Try to extract the command as a script
    if (existing.type === 'command' && existing.command) {
      fs.writeFileSync(backupPath, `#!/usr/bin/env node\nconsole.log('${existing.command.replace(/['"\\]/g, '\\$&')}');\n`);
      log('Backed up existing statusLine → 00-user.cjs');
    }
  }

  // 2. Copy aggregator
  if (fs.existsSync(AGGREGATOR_SRC)) {
    fs.copyFileSync(AGGREGATOR_SRC, AGGREGATOR_DST);
    log('Aggregator installed');
  }

  // 3. Scan for existing plugin status scripts
  const count = fs.readdirSync(STATUS_DIR).filter(f => f.endsWith('.cjs') || f.endsWith('.js')).length;
  log(`Found ${count} status script(s)`);

  // 4. Set statusLine
  settings.statusLine = {
    type: 'command',
    command: `node ${AGGREGATOR_DST.replace(/\\/g, '/')}`,
  };
  writeJSON(SETTINGS, settings);
  log('StatusLine set to aggregator');

  log('');
  log('Done! Restart Claude Code to see the aggregated status bar.');
}

function cmdUninstall(purge) {
  // Restore backup
  const settings = readJSON(SETTINGS) || {};
  const backupPath = path.join(STATUS_DIR, '00-user.cjs');
  if (fs.existsSync(backupPath)) {
    // Read the backup and try to restore the original command
    try {
      const content = fs.readFileSync(backupPath, 'utf8');
      const match = content.match(/console\.log\('(.+)'\)/);
      if (match) {
        settings.statusLine = { type: 'command', command: match[1] };
        log('Restored original statusLine');
      }
    } catch {}
  } else {
    delete settings.statusLine;
  }
  writeJSON(SETTINGS, settings);

  if (purge) {
    try { fs.rmSync(STATUS_DIR, { recursive: true, force: true }); log('Status scripts deleted'); } catch {}
  } else {
    log('Status scripts preserved at ' + STATUS_DIR);
  }
  log('Uninstall complete');
}

function cmdFix() {
  const settings = readJSON(SETTINGS) || {};
  if (!fs.existsSync(AGGREGATOR_DST)) {
    if (fs.existsSync(AGGREGATOR_SRC)) {
      fs.copyFileSync(AGGREGATOR_SRC, AGGREGATOR_DST);
    } else {
      warn('Aggregator not found. Reinstall claude-statusline.');
      return;
    }
  }
  settings.statusLine = {
    type: 'command',
    command: `node ${AGGREGATOR_DST.replace(/\\/g, '/')}`,
  };
  writeJSON(SETTINGS, settings);
  log('StatusLine restored to aggregator');
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
    console.log(`Usage: claude-statusline <command>

Commands:
  install               Install aggregator, backup existing statusLine
  uninstall [--purge]   Restore backup, optionally delete scripts
  fix                   Restore aggregator if overwritten
  status                Show current status scripts
`);
    return;
  }
  switch (args[0]) {
    case 'install': cmdInstall(); break;
    case 'uninstall': cmdUninstall(args.includes('--purge')); break;
    case 'fix': cmdFix(); break;
    case 'status': cmdStatus(); break;
    default: warn('Unknown command: ' + args[0]);
  }
}
main();
