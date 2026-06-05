#!/usr/bin/env node
/**
 * cc-statusline: one-shot aggregator.
 * CC spawns fresh per render, writes JSON to stdin, closes it.
 * We pipe JSON to all chained sources, collect outputs, merge.
 */
const { execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-statusline");
const SOURCES_FILE = path.join(CONFIG_DIR, "sources.json");
const CACHE_DIR = path.join(os.homedir(), ".claude", "plugins", "cache");
const ONESHOT_TIMEOUT = 5000;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")); } catch { return { chains: [] }; }
}

/**
 * Try to run a chain source and return its output.
 * Falls back to resolving from plugin cache if the stored command fails.
 */
function runChain(src, json) {
  // 1. Try the stored command first
  const cmd = src.command || 'node "' + src.path + '"';
  try {
    const o = execSync(cmd, {
      encoding: "utf8",
      timeout: ONESHOT_TIMEOUT,
      input: json,
      stdio: ["pipe", "pipe", "ignore"],
      shell: true,
    }).trim();
    if (o) return o;
  } catch {}

  // 2. Fallback: resolve via identity if available
  if (src.identity) {
    const m = src.identity.match(/^plugin:(.+?)\/(.+)$/);
    if (m) {
      let market = m[1], name = m[2];

      // Identity may have glob artifact (e.g. "plugin:*/claude-hud") — resolve by name
      if (market === "*") {
        try {
          for (const sub of fs.readdirSync(CACHE_DIR)) {
            const candidate = path.join(CACHE_DIR, sub, name);
            if (fs.existsSync(candidate)) { market = sub; break; }
          }
        } catch {}
      }

      const pluginDir = path.join(CACHE_DIR, market, name);
      try {
        const versions = fs.readdirSync(pluginDir).filter(d => /^\d/.test(d)).sort().reverse();
        if (versions.length > 0) {
          const versionDir = path.join(pluginDir, versions[0]);
          // Try common entry points in order of likelihood
          const candidates = [
            { file: "dist/index.js", args: [] },
            { file: "plugin/scripts/statusline.cjs", args: [] },
            { file: "scripts/statusline.cjs", args: [] },
            { file: "index.js", args: [] },
            { file: "cli.bundle.mjs", args: ["statusline"] },
          ];
          for (const c of candidates) {
            const fp = path.join(versionDir, c.file);
            if (fs.existsSync(fp)) {
              const fullCmd = `node "${fp}"${c.args.length ? " " + c.args.join(" ") : ""}`;
              try {
                const o = execSync(fullCmd, {
                  encoding: "utf8",
                  timeout: ONESHOT_TIMEOUT,
                  input: json,
                  stdio: ["pipe", "pipe", "ignore"],
                  shell: true,
                }).trim();
                if (o) return o;
              } catch {}
            }
          }
        }
      } catch {}
    }
  }

  return "";
}


/**
 * Auto-discover statusline plugins from plugins/cache/ when chains are empty.
 * Scans known plugin directories, finds latest versions, runs them, and persists to sources.json.
 */
function autoDiscover(json) {
  const knownPlugins = [
    { name: 'claude-hud', label: 'claude-hud', entry: 'dist/index.js',
      buildCmd: (ep) => 'cols=$(stty size </dev/tty 2>/dev/null | awk \'{print }\'); export COLUMNS=$(( ${cols:-120} > 4 ? ${cols:-120} - 4 : 1 )); exec node "' + ep.replace(/\\/g, '/') + '"'
    },
    { name: 'cc-trace', label: 'cc-trace', entry: 'scripts/statusline.cjs',
      buildCmd: (ep) => `node "${ep}"`
    },
    { name: 'cc-rtk', label: 'cc-rtk', entry: 'scripts/statusline.cjs',
      buildCmd: (ep) => `node "${ep}"`
    },
    { name: 'cc-ds', label: 'cc-ds', entry: 'scripts/statusline.cjs',
      buildCmd: (ep) => `node "${ep}"`
    },
    { name: 'context-mode', label: 'context-mode', entry: 'cli.bundle.mjs',
      buildCmd: (ep) => `node "${ep}" statusline`
    },
  ];

  const discovered = [];

  for (const p of knownPlugins) {
    try {
      const dirs = fs.readdirSync(CACHE_DIR);
      for (const market of dirs) {
        const pluginDir = path.join(CACHE_DIR, market, p.name);
        if (!fs.existsSync(pluginDir)) continue;
        const versions = fs.readdirSync(pluginDir).filter(d => /^\d/.test(d)).sort().reverse();
        if (versions.length === 0) continue;
        const versionDir = path.join(pluginDir, versions[0]);
        const entryPath = path.join(versionDir, p.entry);
        if (!fs.existsSync(entryPath)) continue;

        const cmd = p.buildCmd(entryPath);
        const identity = `plugin:${market}/${p.name}`;

        try {
          const o = execSync(cmd, {
            encoding: 'utf8',
            timeout: ONESHOT_TIMEOUT,
            input: json,
            stdio: ['pipe', 'pipe', 'ignore'],
            shell: true,
          }).trim();
          if (o) {
            discovered.push({ identity, cmd, label: p.label, output: o });
          }
        } catch {}
      }
    } catch {}
  }

  // Persist to sources.json
  if (discovered.length > 0) {
    try {
      const config = readConfig();
      const chains = config.chains || [];
      let changed = false;

      for (const d of discovered) {
        if (!chains.some(c => c.identity === d.identity)) {
          chains.push({
            label: d.label,
            path: d.cmd,
            command: d.cmd,
            identity: d.identity,
            detected: new Date().toISOString(),
            priority: 0,
          });
          changed = true;
        }
      }

      if (changed) {
        config.chains = chains;
        const tmp = SOURCES_FILE + '.tmp.' + process.pid;
        fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n');
        fs.renameSync(tmp, SOURCES_FILE);

        // Also ensure settings.json points to cc-statusline
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          const ourCmd = `node "${__filename}"`;
          if (!(settings.statusLine?.command || '').includes('cc-statusline')) {
            settings.statusLine = { type: 'command', command: ourCmd };
            const stmp = settingsPath + '.tmp.' + process.pid;
            fs.writeFileSync(stmp, JSON.stringify(settings, null, 2) + '\n');
            fs.renameSync(stmp, settingsPath);
          }
        } catch {}
      }
    } catch {}
  }

  return discovered.map(d => d.output);
}

function readStdin() {
  return new Promise((resolve) => {
    const c = [];
    process.stdin.on("data", (d) => c.push(d));
    process.stdin.on("end", () => resolve(Buffer.concat(c).toString()));
    setTimeout(() => resolve(c.length > 0 ? Buffer.concat(c).toString() : ""), 500);
  });
}


async function main() {
  const json = await readStdin();
  const config = readConfig();
  let outputs = [];

  // cc-statusline indicator (golden)
  const R = "\x1b[38;2;255;185;15m[↪▨]\x1b[0m ";

  // Sort by priority (lower = earlier), default 99
  const sorted = [...(config.chains || [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  // Run all chain sources — JSON piped to all, non-readers ignore it
  for (const src of sorted) {
    const o = runChain(src, json);
    if (o) outputs.push(o);
  }

  // Self-healing: if chains produced nothing, auto-discover from plugins/cache/
  if (outputs.length === 0) {
    const discovered = autoDiscover(json);
    outputs.push(...discovered);
  }

  // Aggregator
  try {
    const raw = await new Promise((resolve) => {
      const r = http.get({ hostname: "localhost", port: 13781, path: "/status", timeout: 2000 }, (res) => {
        let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve(d));
      });
      r.on("error", () => resolve(null)); r.on("timeout", () => { r.destroy(); resolve(null); });
    });
    if (raw) { const d = JSON.parse(raw); if (d.ds) outputs.push(d.ds); }
  } catch {}

  if (outputs.length > 0) {
    let line = R;
    for (let i = 0; i < outputs.length; i++) {
      if (i > 0) line += outputs[i - 1].includes("\n") ? "\n" : " | ";
      line += outputs[i];
    }
    process.stdout.write(line + "\n");
  }
}

main();
