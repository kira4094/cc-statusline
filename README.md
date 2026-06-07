# cc-statusline 🔗

[中文](README.zh.md)

[![GitHub stars](https://img.shields.io/github/stars/kira4094/cc-statusline?style=social)](https://github.com/kira4094/cc-statusline) <sub>⭐ Star us on GitHub!</sub>

**The aggregator.** One status bar to show them all.

cc-statusline turns your Claude Code status bar into a shared space — all your plugins' stats displayed together in one line.

```
[↪▨] [deepseek-v4-flash[1M]] ██████░░░░ 55% | git:(master*) | tok: ...
 ⏵⏵ accept edits on (shift+tab to cycle)
[trace[ON]] | 6proj | 9ses | [rtk[ON]] | cmd:127 | -762k | ~75%
```

## What it aggregates

| Source | What you see |
|--------|-------------|
| [cc-trace](https://github.com/kira4094/cc-trace) | Session count, project count, server status |
| [cc-rtk](https://github.com/kira4094/cc-rtk) | Commands processed, tokens saved, compression ratio |
| [cc-ds](https://github.com/kira4094/cc-ds) | DeepSeek balance, cache hit rate |
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Model, context %, git branch, tokens, cost |
| Your scripts | Any one-shot statusLine script, just add to the chain |

## How it works

CC sends a JSON payload to the statusLine process on every render. cc-statusline:

1. Reads that JSON
2. Spawns claude-hud with it (full HUD display)
3. Runs every chained source
4. Merges everything into one line

No daemons, no background processes. Just a middleman that plays nice with everyone.

## Install

Two ways. **After installing, you MUST run `/cc-statuslineSetup` or the aggregator won't work.**

### Option 1: Plugin install (recommended)

```
/plugin marketplace add kira4094/cc-statusline
/plugin install cc-statusline
/reload-plugins
/cc-statuslineSetup    ← REQUIRED! Deploys the aggregator
```

Restart Claude Code. You'll see `[↪▨]` at the bottom.

### Option 2: npm install

```bash
npm install -g @kira4094/claude-statusline
claude-statusline install
```

**Restart Claude Code**, then inside CC run:

```
/cc-statuslineSetup    ← REQUIRED! Deploys the aggregator
```

### What `/cc-statuslineSetup` does

- Detects your existing statusLine (claude-hud, ds-hud, etc.)
- Chains them into the aggregator
- Sets cc-statusline as the main statusLine
- Creates a restore point for clean uninstall

**Without this step, the aggregator won't chain anything and your status bar won't show plugin stats.**

## Uninstall

### Plugin uninstall
```
/cc-statuslineUninstall              ← Restores previous statusLine
/reload-plugins
/plugin uninstall cc-statusline
/reload-plugins
```

### npm uninstall
```bash
claude-statusline uninstall --purge
npm uninstall -g @kira4094/claude-statusline
```

Then restart Claude Code and run:

```
/cc-statuslineUninstall              ← Restores previous statusLine
/reload-plugins
```

Your original statusLine comes back. Like it never happened.

## Add your own scripts

Any one-shot script that outputs to stdout can join. Drop it in `~/.claude/statusline/` and it gets called on every CC render.

## Smart chaining

- **Installed first?** You're the statusLine. New tools that write to settings.json get detected and chained automatically.
- **Installed second?** The installer detects your existing statusLine and chains it. Nothing lost.
- **Guard hook:** If another tool overwrites your statusLine, the guard catches it on restart and restores the chain.

## Commands

| Command | What it does |
|---------|-------------|
| `/cc-statuslineSetup` | First-time setup — detect, chain, configure |
| `/cc-statuslineUninstall` | Clean removal — restore previous statusLine |

## What it's NOT

cc-statusline is a **pure aggregator**. It doesn't replace claude-hud, doesn't replace cc-rtk, doesn't collect its own data. It just gives everything a place to live together. Each plugin keeps its own identity, its own color, its own personality. They just share a room now.

## License

MIT.
