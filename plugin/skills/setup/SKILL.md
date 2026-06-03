---
name: setup
description: Configure statusLine in settings.json — chains existing tools, prevents overwrites
disable-model-invocation: false
allowed-tools: [Bash]
---

Run the statusLine installer to configure settings.json:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/installer.cjs"
```

If the user asks about what this does, explain:
- Detects any existing statusLine (claude-hud, ds-hud, etc.)
- Chains them into the cc-statusline aggregator
- Sets cc-statusline as the main statusLine in settings.json
- Adds a guard hook to prevent accidental overwrites
- Creates a restore point at ~/.claude-statusline/sources.json

After running: `/reload-plugins` to apply changes.
