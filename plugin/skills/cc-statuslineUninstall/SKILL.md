---
name: cc-statuslineUninstall
description: Restore settings.json before removing cc-statusline — reverts statusLine and hooks
disable-model-invocation: false
allowed-tools: [Bash]
---

Run the uninstaller before removing the plugin:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/uninstaller.cjs"
```

What it does:
- Restores previous statusLine (or removes if none existed)
- Removes cc-statusline hooks
- Cleans up ~/.claude-statusline/

After: `/reload-plugins`, then `/plugin uninstall cc-statusline`
