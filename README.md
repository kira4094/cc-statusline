# cc-statusLine 🔗

**Unified status line for Claude Code.** Aggregates data from cc-trace, cc-rtk, DeepSeek proxy, and any other statusLine tool into one combined status bar.

```
DS:¥363.36 · HIT+727k · req:142 | trace:8ses/2mem | rtk:-340k
```

## Install

```bash
/plugin marketplace add kira4094/cc-statusline
/plugin install cc-statusline
/reload-plugins
/cc-statusline:setup
```

Then **restart Claude Code**.

## What it aggregates

| Source | Port | Data |
|--------|------|------|
| cc-trace | :13779 | Session count, memory count |
| cc-rtk | rtk binary | Token savings |
| DeepSeek proxy | :13780 | Balance, cache hits, req count |
| Chained sources | — | claude-hud, ds-hud, test scripts |

## Smart chaining

- **Installed first**: Sets the statusLine. Other tools chain through it.
- **Other tool installed first**: Detected and chained. If overwritten, guard hook restores.
- **Test scripts**: `statusline-01.cjs` and `statusline-02.cjs` for testing aggregation.
