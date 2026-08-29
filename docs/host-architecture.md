# MiniApp Host 架构大纲（host-core · createHost）

> 状态：**大纲**（2026-09；2026-08-29 五包合并）。dotnet HostBuilder 风格的组合根：`createHost(adapter, options)` → host 实例 → 生命周期方法。
> 目标：host-core 是 **agent 无关**的 host 能力库；任何 agent（dsh / PI）只实现一个 adapter 插件实例即可获得完整 mini-app host。

## 0. 产品包面（5）

| Package | Role |
|---------|------|
| `panel-core` | Pure React panel UI (zero host) |
| `host-core` | Agent-agnostic host: createHost, runtime, node fs, git (isomorphic-git), tools, bridge, ports, builtin themes |
| `ui` | Component library |
| `dsh-plugin` | Sole dsh host shell + adapter + skill path helpers (`src/skills.ts`) |
| `smoke-test` | Integration tests against the stack |

Absorbed (do not import as packages): runtime-core, adapter-node, adapter-dsh, app-history, app-history-git, agent-core, agent-skills, ui-core, host-port, bridge-protocol, api-client, theme-light, theme-dark, tauri-integration.

## 1. 分层总览

```
panel-core        React UI 核心（零宿主：组件/store/主题/默认行为）
host-core         agent 无关 host 能力（createHost 组合根 + runtime/git/tools/bridge）
dsh-plugin        接缝实现（dsh-adapter.ts）+ client/ 壳 + skills.ts
```

依赖方向（单向）：`panel-core ← host-core ← dsh-plugin`。

## 2. createHost —— 组合根

```ts
// host-core/src/host.ts
export function createHost(adapter: HostAdapter, options: HostOptions): Host
```

### HostAdapter（插件实例接口——agent 能力接缝）

```ts
export interface HostAdapter {
  // 数据面
  listApps(): Promise<{ apps: AppItem[]; runtimeRoot?: string }>
  // 调用面
  callApp(appId: string, method: string, args: unknown, signal?: AbortSignal): Promise<unknown>
  // 宿主接入面（可选）
  listTools?(): unknown[]
  pendingOpen?(): { appId?: string } | null
  ackPendingOpen?(): void
  onHostPortChanged?(port: number): void
  // LLM 能力（宿主提供——dsh: ctx.llm.stream；PI: 模型接口）——host-core 不实现 provider 客户端。
  // 语义：纯 LLM 调用，无额外 tools，等价直接调 chat completion 接口。
  llm?(prompt: string, opts?: Record<string, unknown>): Promise<string>
  // Agent 能力（宿主提供——dsh: agents/subagents.run；PI: 它的 agent API）——host-core 不实现 harness。
  // 语义：携带 agents harness 能力的调用（有 tools/循环），等价在 agent chat 里发一条消息。
  agent?(goal: string, opts?: Record<string, unknown>): Promise<string>
  // 生命周期钩子（可选——agent 挂载/卸载时的宿主操作）
  attach?(ctx: unknown): void | Promise<void>   // dsh：注册 tools、注入 UI slots
  detach?(): void | Promise<void>
}
```

### HostOptions

```ts
export interface HostOptions {
  runtimeRoot: string
  hostPort: number
  demoDir?: string
  themeId?: string
  // 各 Manager 可覆盖注入（默认实现来自 host-core 纯函数）——见 §3
  apps?: AppsManager
  themes?: ThemesManager
  skills?: SkillsManager
  tools?: ToolsManager
  git?: GitManager
  ui?: UiCompiler
}
```

### Host 生命周期

```ts
export interface Host {
  /** 组装 + attach(adapter) + 起 HTTP——一步到位（dsh 场景） */
  apply(ctx?: unknown): Promise<{ port: number }>
  /** 只起服务（ctx 已由 adapter 自持时用，PI 场景） */
  start(): Promise<{ port: number }>
  /** 停 HTTP + detach(adapter) */
  stop(): Promise<void>
  get port(): number
}
```

## 3. 子系统大纲（逐个落实）

> **接口判定原则**（避免伪抽象）：
> - **有状态 / 生命周期 / 操作集** → Manager 接口（可注入 HostOptions）
> - **纯函数 / 纯 getter** → 纯函数导出（不包装接口、不注入）——utils 就是 utils
> 现状列 = 当前散落位置；目标 = 接口形态；归属 = 宿主无关的默认实现。

### 3.1 AppsManager —— apps loader/manager

```ts
export interface AppsManager {
  /** 应用列表（manifest 解析 + 元数据 enrich：commits/acronym） */
  list(): Promise<AppItem[]>
  /** app 目录解析（id → 绝对路径） */
  dirOf(appId: string): string
  /** 加载 app 入口（main.api 编译 + defineDashboard 缓存） */
  load(appDir: string): { def: DashboardDef; ctx: AppContext }
  /** 删除 app（磁盘 + 缓存清理） */
  remove(appId: string): Promise<void>
}
```

- **现状**：`host-core` `createRuntime`（manifests/storage/bridge）+ `AppsManager`（loadAppFile/getDashboard）+ `createAgentHandlers`（mini_app_list → enrichAppMeta）
- **目标**：`dirOf` 统一（`defaultResolveAppDir`）
- **归属**：host-core（runtime 端口在同一包）

### 3.2 ThemesManager —— themes loader/manager

```ts
export interface ThemesManager {
  /** 内置 + 自定义主题列表（ThemePop 数据源） */
  list(): Promise<PaletteInfo[]>
  /** 自定义主题 CSS（runner 注入） */
  customCss(): string
  /** 每 app 主题覆盖（theme.json 读写） */
  appTheme(dir: string): { theme: string; palette: string } | null
  setAppTheme(dir: string, t: { theme: string; palette: string } | null): void
}
```

- **现状**：内置 `panel-core.PALETTES/TOKENS`；自定义 `host-core.loadCustomPalettes/customPaletteCss`；app 覆盖 `app-meta.readAppTheme/writeAppTheme`
- **目标**：panel-core 只管 token 数据；host-core 的 ThemesManager 管加载/组合/持久化；dsh 的 client 主题探测（syncThemeFromDsh）保持 shell 层
- **归属**：host-core（内置数据来自 panel-core）

### 3.3 SkillsManager

```ts
export interface SkillsManager {
  getSkillDir(): string
  getSkillMarkdown(): string
  getTemplateFiles(name: string): Record<string, string>
}
```

- **现状**：`dsh-plugin/src/skills.ts`（getSkillDir/getSkillMarkdown/getTemplateFiles）解析 `skills/monkey-mini-app`
- **判定**：纯 getter 集合，**不构成 Manager 接口**（避免凑接口）——不进 HostOptions
- **归属**：dsh-plugin（skill 树与插件同包）

### 3.4 ToolsManager —— tools prepare/inject

```ts
export interface ToolsManager {
  /** 收集 agent 可见工具定义（mini_app_* + skills + llm 等） */
  prepare(): ToolDefinition[]
  /** 注入到宿主（dsh: ctx.tools.register；PI: 对应 API）——由 adapter.attach 调用 */
  inject(ctx: unknown): void
  /** 执行某个工具（供宿主按名调用） */
  invoke(name: string, args: unknown, signal?: AbortSignal): Promise<unknown>
}
```

- **现状**：`host-core` 的 `listAgentTools/createAgentHandlers/invokeAgentTool`（mini_app_* 协议）+ `dsh-plugin` 的 defineTool 注册
- **目标**：prepare = host-core 工具定义；inject = adapter.attach（dsh 注册 tools / PI 注册命令）；defineDashboard 的「dashboard 执行」进 AppsManager.load
- **归属**：host-core（工具定义与执行）；inject 的宿主对接在 adapter

### 3.5 GitManager

```ts
export interface GitManager {
  commitCount(dir: string): Promise<number>
  log(dir: string, limit: number): Promise<Commit[]>
  fileStats(dir: string, id: string): Promise<FileStat[]>
  filePreview(dir: string, id: string, path: string): Promise<string>
}
```

- **现状**：`host-core/git.ts` **单一 isomorphic-git 模块**——HistoryPort 写（init/commit/list/revert/resetTo）+ Host UI 读（commitCount/log/fileStats/filePreview）。无 `child_process` git CLI。
- **判定**：同一领域（git I/O）合在一个模块；HistoryPort 仍是类型端口，实现就是 `createGitHistoryAdapter()`
- **归属**：host-core

### 3.6 UiCompiler

```ts
export interface UiCompiler {
  compile(appDir: string): Promise<UiBuildFile[]>
  invalidate(appDir: string): void
}
```

- **现状**：`host-core/compile-ui.ts`（esbuild-wasm + 磁盘/内存缓存）——**已达标**
- **目标**：端口化（createHost 默认注入），无迁移
- **归属**：host-core

### 3.7 LLM / Agent —— 宿主能力，host-core 不实现 provider/harness

```ts
// 不在 host-core 实现任何 AI provider 客户端 / agent harness。二者都是宿主能力：
//   llm:   dsh ctx.llm.stream（拼流） / PI 模型接口 —— 纯调用，无 tools
//   agent: dsh agents/subagents.run / PI agent API —— 带 harness（tools/循环）
// host-core 不兜底：宿主无能力则明确失败，不自己造。
```

- **现状问题**：
  - `llmViaOpenAICompat`（自实现 OpenAI 兼容客户端）——实现不全 + 归属错 + 违背「ctx.llm 走宿主」约束
  - `collectLlmStream`（过滤 dsh 流格式）——dsh 特定，不该在 host-core
  - dsh bridge 的 `agent` fallback 用 llm 循环模拟 harness——同病
- **目标**：
  1. `llmViaOpenAICompat` 删除；`collectLlmStream` 移 dsh adapter
  2. `agent` 由 adapter 提供；删「llm 模拟 agent」fallback
  3. `withJsonInstruction` / `coerceSchemaJson` 是 **host-core 纯函数**（prompt 文本处理），**不包装成接口、不参与 createHost 注入**（utils 就是 utils）

### 3.8 HttpHost —— HTTP 服务面

```ts
export interface HttpHost {
  start(): Promise<number>
  rebind(port: number): Promise<void>
  stop(): Promise<void>
}
```

- **现状**：`host-core/http.ts`（MiniAppHost 类 + 路由）——**路由已按 HostApi 接口解耦**
- **目标**：MiniAppHost 重构为 createHost 内部实现（§2）；路由的「业务处理器」改从 createHost 的 managers 取（apps/themes/git 不再走 adapter，直接 manager）
- **归属**：host-core

### 3.8 Agent —— 宿主能力（同 LLM 原则）

```ts
// host-core 不实现任何 agent harness。agent 调用是宿主能力：
//   dsh: get("agents")/get("subagents") → run / spawn
//   PI:  它自己的 agent 运行器
// host-core 不兜底：宿主无 agent 能力则 adapter.agent 抛「not available」，不自己用 llm 模拟。
```

- **现状问题**：dsh bridge 的 `agent` 最坏 fallback 是「单次 llm 循环模拟 agent」（maxIterations 反复调 llm）——**与 llmViaOpenAICompat 同病**：宿主没有就自己造 harness
- **目标**：
  1. `agent` 由 adapter 提供（`get("agents").run/spawn` 优先；无则明确失败）
  2. **删除「llm 模拟 agent」fallback**
  3. `llm` 与 `agent` 语义在类型层区分（纯调用 vs harness 调用）——app 侧按需选用

## 4. dsh 接入形态（目标）

```ts
// dsh-plugin/src/index.ts
export async function apply(ctx: LooseCtx, config: Config = {}) {
  const host = createHost(dshAdapter(ctx, config), {
    runtimeRoot: resolveRuntimeRoot(config),
    hostPort: saved.hostPort,
    demoDir: ...,
    // managers 默认注入；dsh 可覆盖 tools（dsh-tools）
  })
  const { port } = await host.apply(ctx)   // attach（注册 tools/UI slots）+ 起 http
  return () => host.stop()
}
```

`dshAdapter(ctx, config)`：闭包捕获 ctx，实现 HostAdapter（listApps → handlers.mini_app_list；callApp → callMainApi；attach → 注册 tools + inject UI slots）。

## 5. PI 接入形态（未来）

```ts
const host = createHost(piAdapter(pi), { runtimeRoot, hostPort })
await host.start()          // adapter 自持 ctx，无需 apply(ctx)
// 面板 UI：panel-core createMiniAppPanel(piUiAdapter)（已可用）
```

## 6. 迁移路径（分步，每步门禁：build + UT + 实测）

1. **MiniAppHost → createHost**：类改工厂函数 + adapter 前置参数（§2 签名）；生命周期 apply/start/stop
2. **路由依赖 managers**：HttpHost 的处理器从 createHost 的 managers 取（apps/themes/git），去掉对 adapter 的过度依赖（listApps/callApp 留 adapter）
3. **AppsManager 抽取**：loadAppFile/getDashboard/dashboardCache 移入 host-core（§3.1）
4. **ToolsManager 抽取**：prepare/inject 端口化（§3.4）；dsh 的 tools 注册收敛到 adapter.attach
5. **Manager 覆盖注入**：HostOptions 支持 managers 覆盖（测试/定制用）
6. **PI 验证**：app-host 或新 skeleton 用 createHost 起 host（无 dsh）

## 7. 未决问题

- UI 接缝（MiniAppAdapter）与服务接缝（HostAdapter）保持分离——**确认**（浏览器/服务运行时隔离，合一价值低）
- adapter 单实例 vs 多实例（dotnet AddHostedService 支持多）——**单实例**（当前单宿主，YAGNI）
- `apply(ctx)` 是否需要显式 tools 注册参数，还是全部走 adapter.attach 钩子——**倾向 attach 钩子**（adapter 自持 ctx）

## 8. 生命周期时序

```
apply(ctx)                     start()（PI）
  │                              │
  ├─ manager 构建（默认实现）      ├─ manager 构建
  ├─ host.http 创建              ├─ host.http 创建
  ├─ adapter.attach(ctx)         └─ await http.start(port)
  │   ├─ tools: ToolsManager.inject(ctx)      └─ 返回 { port }
  │   ├─ ui: 注入 client 入口/slots
  │   └─ skills: 注册 skill 提示
  ├─ await http.start(port)
  └─ 返回 { port }

stop()
  ├─ http.stop()
  └─ adapter.detach()（撤销 tools/UI/slots）
```

可逆性：apply/start 的每一步都可回滚（disposers 栈），stop 按逆序清理——dsh 插件热重载安全。

## 9. HTTP 路由 → Manager / Adapter 映射

| 路由 | 数据源（createHost 内取） |
|---|---|
| `/api/apps` | AppsManager.list（adapter.listApps 兜底） |
| `/app/:id`（runner HTML） | UiCompiler 相关的 runner（themes.customCss） |
| `/api/app/:id/ui/:file` | UiCompiler.compile |
| `/api/apps/:id/history` | GitManager.log/fileStats/filePreview |
| `/api/apps/:id/storage` | AppsManager 的 storage 端口（runtime） |
| `/api/apps/:id/theme` | ThemesManager.appTheme/setAppTheme |
| `/api/call` | adapter.callApp（App 执行引擎） |
| `/api/palettes` | ThemesManager.list |
| `/api/host-config` | HttpHost（host-config 端口） |
| `/api/pending-open` | adapter.pendingOpen/ack |
| `/api/ctx-tools` | adapter.listTools |

## 10. 核心类型定义

```ts
export type AppItem = {
  id: string
  name: string
  description?: string
  acronym?: string
  version?: string
  commits?: number
  theme?: { theme?: string; palette?: string } | null
}

export type Commit = { id: string; time: string; message: string }
export type FileStat = { path: string; add: number; del: number }

export type PaletteInfo = {
  id: string
  label: string
  swatch: string
  custom: boolean
  tokens?: { light: TokenSet; dark: TokenSet }
}

export type ToolDefinition = {
  name: string
  description: string
  schema?: Record<string, unknown>
  handler?: (args: unknown, signal?: AbortSignal) => Promise<unknown>
}

export type DashboardDef = {
  name: string
  description: string
  api: Record<string, (ctx: AppContext, args: unknown) => Promise<unknown>>
}

export type UiBuildFile = { name: string; contents: Uint8Array }
```

## 11. 验收门禁（每步迁移）

- `tsc --noUnusedLocals` 0 错误
- 20+ UT 全绿（含 host-core 新 manager 的测试）
- smoke：/api/apps · runner HTML · /api/call · history
- 浏览器实测 90%+ 主路径（入口/面板/app 加载/主题/Escape/dock/历史/设置/关闭）+ errs 0
- 多宿主验证：app-host（或 PI skeleton）用 createHost 起 host（无 dsh）
