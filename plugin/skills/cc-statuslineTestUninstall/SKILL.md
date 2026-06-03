---
name: cc-statuslineTestUninstall
description: Remove test scripts from the aggregation chain
disable-model-invocation: false
allowed-tools: [Bash]
---

Remove the two test statusLine scripts from sources.json chain:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/test-teardown.cjs"
```

After: restart CC or wait for next statusLine refresh
