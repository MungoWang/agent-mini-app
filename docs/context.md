# monkey-mini-app — 会话上下文（给后续 agent / Grok CLI）

> 从网页 Grok 长对话提炼。云端沙箱与本机 CLI **不共享文件系统**。落地请在本机仓库改：
> `~/Workspace/Source/monkey-mini-app-local/monkey-mini-app`
>
> 日期：2026-08-23

## 产品是什么

本地托管的 React mini-app 运行时，给 AI 生成统一规范的小程序：

- 每个 app：`ui.tsx` + `main.api.ts`（Dashboard 协议）
- 统一 host：主题 token、组件袋、JSON storage、版控、嵌入 dsh / 也可 Tauri / web
- 包名：`monkey-mini-app`
- 全局 runtime 默认可配，常见：`~/.monkey-mini-app/runtime`

**不要**让 UI 直接 `import main.api.ts`。UI 只走 `useDashboardApi().call(method, args)` → host `POST /api/call`。

## 仓库与关键文件

```
packages/dsh-plugin/          # 真正跑在 dsh web 里的插件
  src/index.ts                # host：工具、embedded server、loader、runner HTML
  src/client.ts               # dsh 网页：侧栏入口、dashboard、tabs、side panel
  src/ui-kit.ts               # @monkeyagent/ui 运行时袋
  lib/                        # tsup 产物（gitignore），dsh 实际加载这里
  skills/monkey-mini-app/SKILL.md
templates/{hello,todo,sysmon,news}/
docs/context.md               # 本文件
```

改 UI 行为：`src/client.ts`。改 API / 编译 / LLM / runner：`src/index.ts`。改组件袋：`src/ui-kit.ts`。然后 build，**重启 dsh web**，浏览器硬刷新。

## 运行态目录

```
~/.monkey-mini-app/runtime/
  apps/<appId>/               # appId = 目录名 = reverse-DNS
    manifest.json
    ui.tsx                    # 必选 default export
    main.api.ts               # 必选 defineDashboard
    components/**/*.{ts,tsx}  # UI 可相对导入
    lib/**/*.{ts,tsx}         # UI 和后端都可相对导入
    storage/*.storage.json    # ctx.storage；默认 main.storage.json
  llm.json                    # 可选覆盖 { provider, model }
```

`appId` 必须等于目录名。

## dsh 集成（已落地）

- 插件名：`monkey-mini-app`（npm：`@monkey-mini-app/dsh-monkey-mini-app`。dsh 插件列表会剥掉 scope 和 `dsh-` 前缀，所以不要用 `@monkey-mini-app/dsh-plugin`，否则卡片标题会变成 `plugin`）
- 生成 app：**只** `mini_app_register({ appId, files })`，禁止 Write `~/.monkey-mini-app/runtime`；冒烟用 `mini_app_call`，不要 curl；`mini_app_open` 会写 `/api/pending-open`，client 轮询后弹出 Host
- 侧栏 footer 入口文案：**小程序**，风格对齐「设置」（`sidebar.footer.action`）
- 折叠/展开：跟 dsh SidebarRoot 的 `*_collapsed` / `*_railIn`，**不要再量宽度藏字**
- 点入口打开 host 面板；**打开面板时预热** `/api/apps`、`/ui-kit.js`、esm.sh（不要等点进某个 app 才起依赖）
- embedded host：插件 `apply()` 里听 `127.0.0.1:17880`（可用 `MONKEY_MINI_APP_HOST_PORT`）
- 多 app = 顶栏 tabs；侧栏模式 tabs 改成 **下拉**，铺满模式 tabs 单行省略
- 「程序列表」短名：**全部**
- 顶栏 ✕ 左侧：钉到右侧 / 铺满切换，`localStorage.mma-dock` = `fill` | `side`
  - `fill`：left = 左侧栏右缘，占满主区
  - `side`：右侧约 440px；给 `html` 加 `padding-right` 以免挡住聊天输入；left/width 用像素做 320ms 动画
  - 切 dock / 切 tab **不要** `innerHTML` 整页重绘；iframe 按 appId 缓存
- 主题跟 dsh 外观（探测侧栏背景亮度），iframe 用 `postMessage` `{type:"mma-set-env", theme, dock}`
- Esc 关面板；再点侧栏「小程序」切换开/关
- 加载态：居中小窗插画 + 三点，**不要**把 `#root.boot` 的居中样式留到 React 挂载之后
- iframe 必须 `height:100%`（默认约 150px 会只剩一条缝）

### 侧栏入口注意

- 不要 React `onClick` 绑 hook（和 dsh React 实例冲突会点了没反应）
- 用 `data-mma-open` + document capture 点击
- 设置藏字靠 `wide` / `*_collapsed`，小程序按钮同样吃祖先 class

## UI 协议

```tsx
import { useDashboardApi } from "@monkeyagent/ui";
export default function Ui() {
  const { call } = useDashboardApi(); // 只返回 { call }
  // 自己 useState + useEffect，不要 useDashboardApi("method", args)
}
```

禁止 UI：`fetch`、secrets、`ctx.llm/bash/mcp`、`window.mini`。

组件：`@monkeyagent/ui` 是 **轻量 shadcn 同名袋**，不强制只用它。样式优先 CSS tokens：
`--background --foreground --card --primary --primary-foreground --muted --muted-foreground --border --destructive --radius`

iframe runner 从 **esm.sh** 拉 react / react-dom / sucrase。离线会挂。不要为了查 props 去读整份 `ui-kit.js`。

## 后端协议

```ts
import { defineDashboard } from "@monkeyagent/dashboard";
import { parseFeed } from "./lib/parseFeed"; // 可以拆 lib

export default defineDashboard({
  name: "...",
  description: "...",
  api: {
    async refresh(ctx, args) { /* ... */ },
  },
});
```

### loader（已修过一轮，不要再写「零 import」）

`src/*.ts` 是 **唯一源**；`lib/` 由 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`（tsup）生成并 gitignore。不要手改 `lib/`。

`compileAppSource` 用 **sucrase**（typescript + imports）+ scoped `require`：

- ✅ `import { defineDashboard } from "@monkeyagent/dashboard"`
- ✅ 相对路径 `./lib/*` `./components/*`（不能逃出 app 目录）
- ✅ TypeScript（sucrase；参数类型 / `{ title: string }` / `catch (e: any)` 都可以）
- ✅ `export function` / `export const` / `export default`
- ❌ npm 包、Node 内置（`fs` / `rss-parser` / `openai`）
- ❌ 再把 `defineDashboard` 当 `new Function` 第四参（会 already declared）

**禁止**用正则全局删 `: type`：会破坏 `{ key: value }`、`(?:...)`。

缓存：按 `main.api.ts` + `lib/*.{ts,js}` mtime；每次 `loadMainApi` 清 module 图。

抓网页用 `ctx.http`，解析写在 `./lib`。本机命令才 `ctx.bash`。

## ctx（已实现，skill 必须写准）

| API | 返回 | 要点 |
|-----|------|------|
| `storage.get/set/delete/clear` | get → value\|null | `storage/main.storage.json` |
| `storage.table(name)` | 同 API | `{name}.storage.json` |
| `state` / `credentials` / `log` / `push` | | push 常为 no-op |
| `config` | `{ theme, chatLanguage, hostPort, llm }` | 只含本 Host 配置（设置页 + `runtime/host.json`），不是 dsh settings dump |
| `system.metrics()` | os 快照 | |
| `http(url, opts?)` | `{ ok, status, headers, text, json }` | 只 http/https；4xx 不 throw；默认 8s / 8MB。不要再用 bash curl |
| `bash(cmd)` | `{ stdout, stderr, exitCode }` | 本机命令；先本地 `bash -c`，再 dsh `shell.run` |
| `tool(name, args)` | **string** | args 普通 JSON 对象，禁止 `{ input }` / Date / function。宿主调 **tool 定义的 execute(args, exec)**，不要把 dsh `tools.execute` 当成 `(name, args)` |
| `mcp(name, args?)` | string | 不要 `mcp_` 前缀 |
| `llm(prompt, opts?)` | **string** | 见下 |
| `agent(goal, opts?)` | string | 有 agents 用 agents，否则 loop llm |

### LLM

dsh 的 `ctx.llm` 是 **`.stream({ provider, model, messages })`**，不是 `.complete`。

顺序：

1. `ctx.llm.stream`（聊天同一套模型服务）
2. complete / chat / generate（若有）
3. `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` HTTP

路由：`opts.provider/model` → `runtime/llm.json` → 默认 `deepseek-official` / `deepseek-v4-flash`。

```
GET/POST http://127.0.0.1:17880/api/llm-config
{ "provider": "deepseek-official", "model": "deepseek-v4-flash" }
```

设置页卡片（`settings.plugin.item`）还没做。

## Host HTTP

Base：`http://127.0.0.1:17880`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps` | 列表 |
| POST | `/api/call` | `{ appId, method, args }` → `{ ok, value\|error }` |
| GET | `/app/:id` | runner HTML |
| GET | `/ui-kit.js` | 组件袋 |
| DELETE | `/api/app/:id` | 删 app |
| GET/POST | `/api/llm-config` | 默认模型 |

冒烟：

```bash
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

## 版控

每 app 一份轻量 git-like，适配器包一层 **isomorphic-git**，可换实现。

心智（已简化，单分支 + 树仍保留）：

- commit 全量保留，不靠清快照
- `list commits` 展示树
- revert ≈ 从某 commit **分叉**（别做成破坏性 reset 清掉旁支）
- 不要上复杂 merge

## Skill 要求（AI 生成 app 时不要翻源码）

`packages/dsh-plugin/skills/monkey-mini-app/SKILL.md` 必须自包含：

1. Backend runtime constraints（相对导入可以，npm 不行）
2. ctx 契约表（签名 / 返回 / fallback / 报错原文）
3. Host HTTP
4. `bash + llm + ./lib` 完整例子
5. esm.sh + mtime 缓存
6. Checklist：call 键 ⊆ api 键；MCP 不要 `{input}`

权威 skill 只在 dsh-plugin/skills；`@monkey-mini-app/agent-skills` 仅 resolve 该路径。

## 已知坑（修过或仍在）

| 现象 | 原因 / 处理 |
|------|-------------|
| 点小程序没反应 | React 实例冲突 → 事件委托 |
| 折叠仍显示「小程序」或展开不回来 | 用 dsh `*_collapsed`，不要测 56px rail |
| 侧栏动画慢一拍 | 不要给 host `left` 再做 300ms transition，跟侧栏 rAF |
| 深色 All 列表黑字 | button 默认色 → `color: inherit` / tokens |
| All 列表 API 404 | 面板打开就要有 17880，路径 `/api/apps` |
| `Cannot access hostBridge` | apply 里 TDZ，桥要先赋值 |
| `compileAppSource` 弄坏 todo | 禁止全局剥 `: type` |
| `defineDashboard already declared` | 不要当 Function 参数再注入 |
| LLM 提示没 key | 先接 `ctx.llm.stream` |
| bash `policy.mode` undefined | 不要走坏的 dsh sandbox policy，本地 bash -c |
| Sparkline `h` TDZ | 局部变量别叫 `h` |
| 加载插画把 app 挤中间 | 挂载前去掉 `#root.boot` |
| 内容只剩一条缝 | iframe 必须显式 100% 高 |
| 侧栏 tab 挤成两行 | side 模式用 `<select>` |

## 样例 app

- `templates/hello` — 连通检查（ping）
- `templates/todo` — storage CRUD，筛选/表格
- `templates/sysmon` — bash + metrics，不要假数据
- `templates/news` — `ctx.http(RSS)` + `./lib/parseFeed` + `ctx.llm({ schema })`

## 配色（2026-08 更新）

- palette：default / **tokyo**（东京夜）/ **forest**（苔原 Everforest）/ **matcha**（草莓抹茶）/ **yellow**（药丸黄）/ **zoro**（三刀流）/ **hokage**（火影黎明）/ slate（石墨）。删除了 ocean/violet，极简黑 noir 并入 slate（黑白同族）。
- **迁移**：`clampPalette` 旧 id → ocean/mist → tokyo、violet/ink → matcha、paper/noir → slate；旧 localStorage/host.json 自动映射。
- 参考色源：Tokyo Night（#1a1b26/#7aa2f7）、Everforest（#2d353b/#a7c080）、Strawberry Matcha（粉 #ee9aa6）、Yellow Pill（#facc15）、Zoro 三刀流（#4ade80）、Hokage Dawn（#f59e0b）。
- 预览页：`docs/themes-preview.html`（含 Progress 条色板），截图 `docs/themes-preview-{light,dark}.png`。

## Host 列表：三套卡片方案 + monogram + commits

- 卡片方案（`settings` → 卡片方案）：`hero`（渐变字+光晕）/ `etch`（空心描边字）/ `stamp`（线框邮戳，默认）。前端 `state.cardStyle` + `localStorage["mma-card-style"]`，纯前端偏好，不入 host-config。
- monogram：host 端 `acronymOf()` 用 `pinyin-pro` 实时算（中文名前两字声母，英文名取前两字母）；manifest 可选 `acronym` 字段覆盖（见 SKILL.md）。
- commits：`gitCommitCount()`（git rev-list --count HEAD，60s TTL 缓存）——app 无 version 概念，列表 meta 显示「N commits」。
- actions bar 浏览面板：`/api/apps/:id/history[:commit]`（git log + diff-tree numstat + `git show` preview ≤18 行）、`/api/apps/:id/storage[:table]`（动态枚举 storage/*.json）。
- **坑**：esbuild 会把 apply 内后声明的 `appDirOf` 重命名为 `appDirOf2`，但前置定义的 `handleApps` 里引用不会同步重写 → `appDirOf is not defined`。闭包内不要前向引用会被重命名的 const，`handleApps` 自包含定义。
- **坑**：dock 切换（fill/side）模板结构不同（卡 vs 行），`setDock` 必须调 `paintList()` 重渲染，否则样式不切。
- **坑**：改完 `pnpm -r build` 会用旧 src 覆盖 dsh-plugin/lib，务必只跑 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`。

## ui-kit 组件库（2026-08 扩展）

- **文件拆分**：`src/ui-kit.ts`（基础）+ `src/ui-kit/code.ts`（CodeMirror 6：Editor/CodeBlock/JsonBlock/DiffView/copyText/parseUnified）+ `src/ui-kit/extras.ts`（LogViewer/Markdown/KeyValueEditor/TagInput/FileInput/Stepper/SummaryBar）+ `src/ui-kit/data-grid.ts`（DataGrid）。createUiKit 内部 `createXxx(React, ui)` 合并导出。
- **CodeMirror**：ui-kit tsup 需 `noExternal: [/@codemirror/, /@lezer/, /@tanstack/]`（iframe 无 node_modules）；`minify: true`（1.25MB → 706KB）。
- **MergeView**：`a/b` 是 **EditorStateConfig 对象**（`{ doc, extensions }`）——传字符串内容为空，传 `EditorState.create()` 实例会**静默丢掉 extensions**（语法高亮/只读/主题全失效，只剩内容）；外部更新用 `mv.a.dispatch` / `mv.b.dispatch`（无 updateA/B 方法）。`highlightChanges: false` 关闭词级下划线（wording check）；Monaco 风格行背景/gutter 用 `.cm-merge-a/.cm-merge-b .cm-changedLine(Gutter)` 覆盖。
- **CM6 语法高亮是 StyleModule class 模式**（`.ͼx` 类 + 注入 CSS），不是 inline style——断言用 `getComputedStyle(span).color !== 默认前景` 验证，不能查 `.tok-*`。
- **TanStack**：用框架无关的 `@tanstack/table-core` 的 `createTable`，不要 `@tanstack/react-table`（它会带自己的 React 副本 → iframe 里 React 双实例 `useState on null`）。
  - **state 是外部受控**：`getState()` 读 `options.state`，必须在**渲染期间** `table.setOptions(完整配置)` 同步（官方 useReactTable 模式）；放 useEffect 里会渲染读旧值（排序/选中不生效）。
  - **setOptions 每次要带全配置**：core 的 `mergeOptions` 只并默认项，row models（getCoreRowModel 等）/handlers 必须每次显式传入。
  - `flexRender` 是 react-table 层，core 没有（本地 2 行实现）；`getState()` 需要完整 state，必须补 `columnPinning: {left:[],right:[]}`。
  - **checkbox 不要加 `onClick: stopPropagation`**：React 合成事件里会掐掉随后的 onChange（选中/排序失效）；行点击判 `e.target.tagName === 'INPUT'` 跳过即可。
- **React 18 双实例**：同容器重复 `createRoot` 会重建组件并丢状态（onChange 时序错乱），demo/宿主里要缓存 root。
- **实测**：`docs/ui-kit-demo/`（http server + headless chrome dump-dom 断言，40 断言 × light/dark 全过，含点击选中/排序交互模拟）；截图 `docs/ui-kit-demo-all-{light,dark}.png`。
- **Stepper**：圆点必须 `boxSizing: border-box`（active 2px border 不撑大行高，否则横线错位不在同一水平）；连接线激活语义 = **目标步已完成**（左线看 i、右线看 i+1 是否 `< active`），active 步的入线保持未激活；外层容器横向 gap 必须 0（否则相邻步两段线断开）；React 对 border 简写 + var()/color-mix() 解析不可靠 → 用 borderWidth/borderStyle/borderColor 拆分。

## 测试体系（2026-08 扩充，101 UT 全绿）

- `vitest.workspace.ts` 配 workspace alias（@monkey-mini-app/* → 各包 src/index.ts），vitest 才能 import dsh-plugin 的 index.ts。
- **DOM 组件测试用 jsdom**：happy-dom 20 会丢弃 `color-mix()` 样式值（序列化为空）导致断言失真；jsdom 完整保留。文件头 `// @vitest-environment jsdom`。
- 新增测试：`host-logic.test.ts`（acronymOf 5 + git helpers 5 + enrichAppMeta 3）、`parse-unified.test.ts`（6）、`browse-api.test.ts`（listStorageTables/storageTablePath 防穿越 5）、`ui-kit.test.ts`（DataGrid 排序/选中交互 + Stepper + 基础组件 12）、`ui-kit-cm.test.ts`（Editor/CodeBlock/JsonBlock/DiffView/copyText 8）。
- **TanStack 排序断言注意**：默认按 Unicode 码点（注 U+6CE8 < 登 U+767B），中文排序方向与拼音直觉相反；jsdom 把 hex 颜色规范化成 `rgb(220, 38, 38)`。
- 修正过时测试：runtime-core「无权限拒绝」用 `permissions: []` 期望拒绝，但实现语义是「空数组=全部允许」→ 改为 `["ui"]`（显式声明但无 storage）。
- git helpers 依赖系统 git CLI（`execFileAsync git ...`），测试用临时目录 `git init` 造仓库；`gitCommitCount` 有 60s TTL 缓存，同目录连测会命中缓存（测试用多目录验证隔离）。

## 和本机协作

网页 Grok **不能**写你的 Mac。Grok CLI：

```bash
cd /Users/wangpeng/Workspace/Source/monkey-mini-app-local/monkey-mini-app
grok
```

把本文件当项目记忆。改 `src/*.ts` 后 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`，再重启：

```bash
# 视你的启动脚本而定
dsh web   # 或 scripts/run-demo.sh
```

插件本地 link 安装保持「官方 plugin 形态」：`README.md` / `README.zh-CN.md` / `cordis.patch.yml`。
