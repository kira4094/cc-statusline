---
name: status
description: Show current aggregation state from all sources
disable-model-invocation: true
allowed-tools: [Bash]
---

Show the aggregated status:

```
curl -s http://localhost:13781/status
```

Or if aggregator isn't running, read cached data:

```
cat ~/.claude-statusline/agg-data.json
```
