# cc-statusline 🔗

[English](README.md)

[![GitHub stars](https://img.shields.io/github/stars/kira4094/cc-statusline?style=social)](https://github.com/kira4094/cc-statusline) <sub>⭐ 去 GitHub 点个 Star 吧！</sub>

**聚合器。** Claude Code 底部那条细条，cc-statusline 让所有插件都能在上面露脸。

```
[↪▨] [deepseek-v4-flash[1M]] ██████░░░░ 55% | git:(master*) | tok: ...
 ⏵⏵ accept edits on (shift+tab to cycle)
[trace[ON]] | 6proj | 9ses | [rtk[ON]] | cmd:127 | -762k | ~75%
```

## 它能聚合什么

| 来源 | 显示内容 |
|------|---------|
| [cc-trace](https://github.com/kira4094/cc-trace) | 会话数、项目数、服务器状态 |
| [cc-rtk](https://github.com/kira4094/cc-rtk) | 命令数、节省 token、压缩率 |
| [cc-ds](https://github.com/kira4094/cc-ds) | DeepSeek 余额、缓存命中率 |
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | 模型、上下文%、分支、token、费用 |
| 你的脚本 | 随便写个输出到 stdout 的脚本，加进来就行 |

## 原理

CC 每次刷新都往 statusLine 塞一段 JSON。cc-statusline：

1. 读 JSON
2. 启动 claude-hud 传给它
3. 跑一遍链里的所有脚本
4. 合并输出成一行

没有后台进程，没有骚操作，就是个好中介。

## 安装

两种方式。**装完后必须跑 `/cc-statuslineSetup`，否则聚合器不生效。**

### 方式一：插件安装（推荐）

```
/plugin marketplace add kira4094/cc-statusline
/plugin install cc-statusline
/reload-plugins
/cc-statuslineSetup    ← 必选！部署聚合器
```

重启 Claude Code，底部会出现 `[↪▨]`。

### 方式二：npm 安装

```bash
npm install -g claude-statusline
claude-statusline install
```

**重启 Claude Code**，然后在 CC 里执行：

```
/cc-statuslineSetup    ← 必选！部署聚合器
```

### `/cc-statuslineSetup` 做了什么

- 检测现有的 statusLine（claude-hud、ds-hud 等）
- 把它们链进聚合器
- 设置 cc-statusline 为主 statusLine
- 创建恢复点（卸载时干干净净）

**不跑这一步，聚合器不会链入任何插件，状态栏看不到统计数据。**

## 卸载

### 插件方式卸载
```
/cc-statuslineUninstall              ← 恢复之前的 statusLine
/reload-plugins
/plugin uninstall cc-statusline
/reload-plugins
```

### npm 方式卸载
```bash
claude-statusline uninstall --purge
npm uninstall -g claude-statusline
```

重启 Claude Code，然后执行：

```
/cc-statuslineUninstall              ← 恢复之前的 statusLine
/reload-plugins
```

原来的 statusLine 完好无损，就像没发生过。

## 加自己的脚本

随便一个输出到 stdout 的一次性脚本都能加进来。放到 `~/.claude/statusline/` 目录，每次 CC 刷新都会跑它。

## 智能链式

- **先装盒子？** 你就是 statusLine。后面装的其他工具如果写了 settings.json，守卫 hook 自动检测并链入。
- **后装盒子？** 安装器检测到现有的 statusLine，自动链入。不会丢东西。
- **守卫 hook：** 如果其他工具覆盖了你的 statusLine，重启时守卫自动恢复链。

## 命令

| 命令 | 干啥的 |
|------|--------|
| `/cc-statuslineSetup` | 首次安装 — 检测、链入、配置 |
| `/cc-statuslineUninstall` | 干净卸载 — 恢复之前的 statusLine |

## 它不是啥

cc-statusline 是**纯聚合器**。它不替代 claude-hud，不替代 cc-rtk，不自己收集数据。它就是个合租房——每个插件保持自己的 identity、颜色、性格，只是共享一个房间了。

## 协议

MIT。
