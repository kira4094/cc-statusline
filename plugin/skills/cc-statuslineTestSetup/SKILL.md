---
name: cc-statuslineTestSetup
description: Add test scripts (statusline-01, statusline-02) into the aggregation chain
disable-model-invocation: false
allowed-tools: [Bash]
---

Add the two test statusLine scripts to sources.json chain:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/test-setup.cjs"
```

This adds:
- test-01: counter-based (⚡statusline-01:N)
- test-02: timestamp-based (🔷statusline-02:HH:MM)

After: restart CC or wait for next statusLine refresh
