---
name: cc-statuslineSetup
description: Configure statusLine in settings.json — chains existing tools, prevents overwrites
disable-model-invocation: false
allowed-tools: [Bash]
---

Run the statusLine installer to configure settings.json:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/installer.cjs"
```

What it does:
- Detects any existing statusLine (claude-hud, ds-hud, etc.)
- Chains them into the aggregator
- Sets cc-statusline as the main statusLine
- Creates a restore point at ~/.claude-statusline/sources.json

After: `/reload-plugins`
