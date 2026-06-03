# cc-statusLine 🔗

[中文](README.zh.md)

**The box.** One status bar to rule them all.

Tired of your statusLine being a single-tenant apartment? cc-statusline turns it into a shared living space — claude-hud, cc-rtk, your custom scripts, all living together in harmony.

```
[↪▨] [deepseek-v4-flash[1M]] ██████░░░░ 55% | git:(master*) | tok: ...
 ⏵⏵ accept edits on (shift+tab to cycle)
[rtk[active]] | cmd:127 | -762k | ~75%
```

## What it does

**Aggregates.** You know that tiny strip at the bottom of Claude Code? cc-statusline makes it work for *all* your plugins, not just one.

- **claude-hud** → model, context, git branch, tokens, cost, the works
- **cc-rtk** → commands processed, token savings, compression ratio
- **Your scripts** → any one-shot statusLine script, just add to the chain
- **More to come** → cc-trace stats, proxy data, you name it

## How it works

CC sends a JSON payload to the statusLine process on every render. cc-statusline:

1. Reads that JSON
2. Spawns claude-hud with it (gets the full HUD)
3. Runs every chained source in the box
4. Merges everything into one beautiful output

No daemons, no background processes, no hacks. Just a really good middleman.

## Status indicator

Look for the golden `[↪▨]` at the start of your status bar. If it's there, the box is running:

```
[↪▨] [model] ██████░░░░ 55% | git:(master*) | tok: ...
```

No `[↪▨]`? The box isn't loaded. Check your install.

## Install

```bash
/plugin marketplace add kira4094/cc-statusline
/plugin install cc-statusline
/reload-plugins
/cc-statuslineSetup
```

**Restart Claude Code** — you'll see `[↪▨]` appear at the bottom.

### First time? Here's what `setup` does

- Detects your existing statusLine (claude-hud, ds-hud, etc.)
- Chains them into the aggregator
- Sets cc-statusline as the main statusLine
- Creates a restore point (so uninstall is clean)

## Uninstall

```bash
/cc-statuslineUninstall
/reload-plugins
/plugin uninstall cc-statusline
/reload-plugins
```

Your original statusLine comes back. Like it never happened.

## Add your own scripts to the chain

Any one-shot statusLine script that outputs to stdout can join the party. It gets called on every CC render, and its output appears in the merged status bar.

## Smart chaining

- **Installed first?** You're the statusLine. New tools that write to settings.json get detected and chained automatically.
- **Installed second?** The installer detects your existing statusLine and chains it. Nothing lost.
- **Guard hook:** If another tool overwrites your statusLine, the guard catches it on restart and restores the chain.

## What it's NOT

cc-statusline is a **pure aggregator**. It doesn't replace claude-hud, doesn't replace cc-rtk, doesn't collect its own data. It just gives everything a place to live together. Each plugin keeps its own identity, its own color, its own personality. They just share a room now.

## Commands

| Command | Does what |
|---------|-----------|
| `/cc-statuslineSetup` | First-time setup — detects, chains, configures |
| `/cc-statuslineUninstall` | Clean removal — restores previous statusLine |

## License

MIT. Go build something cool.
