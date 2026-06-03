# 插件接入 statusLine 聚合规范

## 规则

1. 脚本放在 `~/.claude/statusline/<优先级>-<插件名>.cjs`
2. 优先级：`00-` 为保留（用户备份），`01-` 起为各插件
3. stdout 输出**一行文本**（不要换行），stderr 忽略
4. **只读操作**，不修改任何文件
5. 超时 1500ms，超时直接静默跳过
6. 如果服务不可用，直接 `process.exit(0)` 不要输出

## 示例

```js
#!/usr/bin/env node
// 01-cc-trace.cjs
const http = require('http');
const req = http.get('http://localhost:13779/api/status', { timeout: 1500 }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const s = JSON.parse(d);
      console.log(`[cc-trace: http://localhost:13779]`);
    } catch {}
  });
});
req.on('error', () => process.exit(0));
req.end();
```

## 安装到聚合器

插件安装时（或第一次运行时）把自己的脚本复制到 `~/.claude/statusline/`：

```bash
cp my-status.cjs ~/.claude/statusline/02-my-plugin.cjs
```

不需要通知聚合器——聚合器每次执行都会扫描目录。
