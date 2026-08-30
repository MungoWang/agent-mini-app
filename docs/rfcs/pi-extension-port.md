# PI Extension Port（调研落地）

> 日期：2026-08-29  
> 目标产品：[abcwyc/pi-agent-desktop](https://github.com/abcwyc/pi-agent-desktop)  
> 状态：调研完成，**未实现**。实现入口拟为 `packages/pi` → `@monkey-mini-app/pi-mini-app`。

## 1. 产品身份（别搞混）

| 项目 | 关系 |
|------|------|
| **abcwyc/pi-agent-desktop** | **本调研目标**：Tauri 壳 + pi-web UI + `@earendil-works/pi-coding-agent` |
| agegr/pi-web | desktop 内嵌的 Web UI 上游 |
| earendil-works/pi | Agent SDK / ExtensionAPI / Skills 真身 |
| vastsa/PI-Desktop、pi-web.dev plugins | **另一套** panel/iframe 插件契约，**不要**按那套做 MVP |

Desktop 本地数据：`~/.pi/agent/`（可用 `PI_CODING_AGENT_DIR` 覆盖）。插件/技能经 Settings → Plugins / Skills（`/api/plugins`、`/api/skills`）管理。

## 2. PI 真实扩展面

### 2.1 分发：Pi Package

- 安装：`npm:` / `git:` / 本地 path → 写入 `~/.pi/agent/settings.json`
- 清单：`package.json` → `"pi": { "extensions", "skills", "prompts", "themes" }`
- 约定目录：`extensions/`、`skills/` 等

官方文档入口：Pi Packages / Extensions / Skills（pi.dev docs）。

### 2.2 Agent 扩展（`ExtensionAPI`）

```ts
export default function (pi: ExtensionAPI) { /* per AgentSession */ }
```

| API | MMA 用途 |
|-----|----------|
| `pi.registerTool({ name, parameters, execute })` | 注册 `mini_app_*` |
| `pi.registerCommand(name, handler)` | `/mini-app` 打开面板入口 |
| `pi.registerShortcut(...)` | 可选热键 |
| `pi.on(event, handler)` | 生命周期 |
| `ctx.ui.notify / confirm / …` | 轻量 UX（偏 TUI；desktop 桥接程度因版本而异） |

工具结果是 Pi 原生 `{ content: [{ type: "text", text }], details }`，**不是** dsh `defineTool` 形状 → 需要 `tool-bridge`。

### 2.3 Skills

- 来源：`~/.pi/agent/skills/`、项目 `.pi/skills/`、**package `pi.skills`**
- Desktop 可开关 model-invocation
- **不要**拷进 `~/.dsh/skills`（那是 dsh 专用）

### 2.4 UI /「嵌入」现实

**有：**

- 会话侧栏、聊天、文件 Tab、Plugins/Skills 弹层
- `lib/desktop-native.ts`（open / reveal / external）— 给 **pi-web UI** 用，不是给 extension factory 的 Cordis slots

**没有（对比 dsh）：**

- Cordis `slots.inject` / footer 按钮注入
- 声明式 `ui.panel` iframe 贡献（vastsa 那套）

**可行的轻嵌入（社区已有类似套路）：**

1. Extension 拉起本机 Host HTTP（我们已有 `HttpGateway`）
2. Slash command 打开 `http://127.0.0.1:<hostPort>/mini-app-panel`
3. 系统浏览器 / `openExternal`；不追求深嵌进聊天侧栏

### 2.5 进程与 IPC 形状

```
Browser (Tauri WebView / localhost)
  ↔ Next.js /api/agent|sessions|plugins|skills|…
  ↔ AgentSession（extensions 随 session 加载；闲置约 10min 销毁）
```

**关键：** `createHost` + `HttpGateway` 必须是 **进程级 singleton**，不能跟 AgentSession 同生共死。

## 3. 映射到 MMA 端口

| MMA 端口 | PI 落点 |
|----------|---------|
| `HostCapabilities` | `PiCapabilities`（bash 先实；llm/agent/mcp 需桥或明确报错） |
| `HostLifecycle` | `PiLifecycle.attach` → `registerTool` / skill 声明 / command |
| `ThemeResource` | MVP 可用 `EMPTY_THEME_RESOURCE` |
| `PanelHost` | `FetchPanelHost` + standalone `/mini-app-panel` 页 |
| `createHost(caps, lifecycle, { config, themes })` | `packages/pi` 组合根（平行 `packages/dsh`） |

```
@monkey-mini-app/pi
  ├── extension.ts          ExtensionAPI factory
  ├── capabilities.ts       PiCapabilities
  ├── lifecycle.ts          PiLifecycle
  ├── host-singleton.ts     ensureHost()
  ├── tool-bridge.ts        ToolDefinition → pi.registerTool
  ├── panel-host.ts         FetchPanelHost
  ├── open-panel.ts         slash command → open URL
  └── skills/monkey-mini-app/
         ↑
   shared host + panel + ui
```

依赖边界与 dsh 相同：`host`/`panel` 互不 import；`pi` → `host` + `panel`。

## 4. MVP（对齐产品意图）

1. 可安装 Pi package（Plugins UI 或 path）
2. 注册 `mini_app_*` tools
3. 随包 skill（`pi.skills`）
4. `/mini-app`（或等价 command）→ ensure Host → 打开 panel URL
5. Standalone panel 页（**host 今天还没有 `/mini-app-panel`**，需补）
6. 复用 `bootstrapHostConfig`；runtime 仍可走 `~/.monkey-mini-app/runtime`

**明确非目标（MVP）：** 深嵌 pi-web 侧栏、与 dsh footer 视觉完全一致、完整 `ctx.llm`/`ctx.mcp` 经 Pi 路由。

## 5. 缺口与风险

| 项 | 说明 |
|----|------|
| 无 chrome plugin slot | 轻嵌入 = 外开 URL |
| 无 `/mini-app-panel` | 必须新增 host 路由或 pi 静态页 |
| Session vs Host 寿命 | Host singleton + 每 session 只挂 tools |
| `ctx.llm` | 无 dsh `llm.stream`；需 modelRegistry/HTTP 桥，否则 app 调 llm 失败 |
| `ctx.agent` | dsh 已 one-shot；PI 侧可后续接 Pi subagent，保持 optional |
| 工具 schema 阻抗 | JSON Schema / 宽松 object → TypeBox + `{ content, details }` |
| 端口冲突 | `17880` 可能与 dsh 抢；PI 配置可另端口 |
| Skill 双份 | dsh / pi 两份 skill 易漂；后续应单一源 + sync |
| Upstream 抖动 | ExtensionAPI / typebox 版本随 desktop 同步而变 |

## 6. 建议落地顺序

1. Spike：空 extension（一 tool + `/ping`）装进 desktop Plugins UI  
2. `packages/pi` 骨架 + `pi` manifest + eslint 边界  
3. Host singleton + bootstrap / install 脚本  
4. `PiLifecycle` + tool-bridge（含 `mini_app_open` → SSE / 开 panel）  
5. 同步 skill  
6. `/mini-app-panel` + `FetchPanelHost` + `registerCommand("mini-app")`  
7. `PiCapabilities`：bash 实；llm/agent 明确错误或最小桥  
8. UT + 手工冒烟；`Agents.md` 补 PI 一节  

## 7. 参考路径（本仓库）

| 用途 | 路径 |
|------|------|
| dsh 参考实现 | `packages/dsh/src/{index,capabilities,lifecycle,client}/**` |
| Host 组合 | `packages/host/src/create-host.ts` |
| Panel 契约 | `packages/mini-app-panel/src/mini-app-panel-host.ts` |
| 拟新增 | `packages/pi/**`、`scripts/install-pi-mini-app.sh` |
| 可能扩展 | `packages/host/src/http/http-gateway.ts`（`/mini-app-panel`） |

## 8. 一句话

对 **pi-agent-desktop**，可行 port = **Pi package**：进程级 Host + `registerTool`/skill + **一条 slash command 打开 localhost panel**。与 `packages/dsh` 平行，不深嵌 chrome，也不要等上游侧栏 slot。
