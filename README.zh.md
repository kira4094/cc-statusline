# cc-statusLine 🔗

[English](README.md)

**聚合器。** 一个状态栏，统治所有。

厌倦了你的 statusLine 只能住一个人？cc-statusline 把它变成了合租房 —— claude-hud、cc-rtk、你自己的脚本，全部挤在一起其乐融融。

```
[↪▨] [deepseek-v4-flash[1M]] ██████░░░░ 55% | git:(master*) | tok: ...
 ⏵⏵ accept edits on (shift+tab to cycle)
[rtk[active]] | cmd:127 | -762k | ~75%
```

## 它能干嘛

**聚合。** Claude Code 底部那条小细条，cc-statusline 让所有插件都能在上面露脸，不用抢位置。

- **claude-hud** → 模型、上下文、分支、token、费用，全套
- **cc-rtk** → 命令数、省了多少 token、压缩率
- **你的脚本** → 随便写个一次性 statusLine 脚本，加进链就行
- **后面还有** → cc-trace 统计、proxy 数据，你想到的都能加

## 原理

CC 每次刷新都往 statusLine 塞一段 JSON。cc-statusline：

1. 读 JSON
2. 启动 claude-hud 传给它（拿到完整 HUD）
3. 跑一遍链里的所有脚本
4. 合并输出 → 一行搞定

没有后台进程，没有骚操作，就是个好中介。

## 状态标志

看 statusLine 开头有没有金色的 `[↪▨]`。有，盒子在工作：

```
[↪▨] [模型] ██████░░░░ 55% | git:(master*) | tok: ...
```

没有？盒子没启动，检查一下安装。

## 安装

```bash
/plugin marketplace add kira4094/cc-statusline
/plugin install cc-statusline
/reload-plugins
/cc-statuslineSetup
```

**重启 Claude Code**，底部会出现 `[↪▨]`。

### setup 做了什么

- 检测你现有的 statusLine（claude-hud、ds-hud 等）
- 把它们链进聚合器
- 设置 cc-statusline 为主 statusLine
- 创建恢复点（卸载时干干净净）

## 卸载

```bash
/cc-statuslineUninstall
/reload-plugins
/plugin uninstall cc-statusline
/reload-plugins
```

原来的 statusLine 完好无损，就像没发生过。

## 加自己脚本

随便一个输出到 stdout 的一次性脚本都能加进来。每次 CC 刷新都会跑它，输出自动合并。

## 智能链式

- **先装盒子？** 你就是 statusLine。后面装的其他工具如果写了 settings.json，守卫 hook 自动检测并链入。
- **后装盒子？** 安装器检测到现有的 statusLine，自动链入。不会丢东西。
- **守卫 hook：** 如果其他工具覆盖了你的 statusLine，重启时守卫自动恢复链。

## 它不是啥

cc-statusline 是个**纯聚合器**。它不替代 claude-hud，不替代 cc-rtk，不自己收集数据。它就是个合租房 —— 每个插件保持自己的身份、颜色、性格，只是共享一个房间了。

## 命令

| 命令 | 干啥的 |
|------|--------|
| `/cc-statuslineSetup` | 首次安装 — 检测、链入、配置 |
| `/cc-statuslineUninstall` | 干净卸载 — 恢复之前的 statusLine |

## 协议

MIT。做点 cool 的东西吧。
