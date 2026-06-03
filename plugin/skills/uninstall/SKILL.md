---
name: uninstall
description: Restore settings.json before removing cc-statusline — reverts statusLine and hooks
disable-model-invocation: false
allowed-tools: [Bash]
---

Run the uninstaller before uninstalling the plugin:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/uninstaller.cjs"
```

What it does:
- Restores previous statusLine from backup (or removes it if none existed)
- Removes cc-statusline hooks from settings.json
- Cleans up ~/.claude-statusline/ data directory

After running: `/reload-plugins`, then `/plugin uninstall cc-statusline`.
