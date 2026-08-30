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
packages/dsh-plugin/          # 真正跑在 dsh web 里的插件（唯一 dsh 壳）
  src/index.ts                # apply：createHost + dsh adapter
  src/dsh-adapter.ts          # HostAdapter（bash/llm/agent/tool/mcp）
  src/client/                 # dsh 网页：侧栏入口、dashboard、tabs、side panel
  src/skills.ts               # resolve skills/monkey-mini-app
  lib/                        # tsup 产物（gitignore），dsh 实际加载这里
  skills/monkey-mini-app/SKILL.md + references/ + templates/
packages/host-core/           # agent 无关 host：createHost / runtime / git / tools / bridge
packages/panel-core/          # 纯 React 面板（零宿主）
packages/ui/                  # @monkey-mini-app/ui 组件库（140+ 组件，独立 workspace 包）
  dist/                       # 扁平具名 index + src + globals.css（node scripts/build-ui.mjs）
packages/smoke-test/          # 集成测试
apps/demo-host/               # 组件库 demo gallery（vite :5173 + e2e）
scripts/generate-skill.mjs    # 组件契约自动生成（pnpm skill:gen）
docs/context.md               # 本文件
```

改 UI 行为：`packages/dsh-plugin/src/client/`。改 host 组装：`dsh-plugin/src/index.ts`。改 UI 编译 / runtime / git：`packages/host-core/src/`。改组件库：`packages/ui/` + `node scripts/build-ui.mjs`。然后 build，**重启 dsh web**，浏览器硬刷新。

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
import { useDashboardApi } from "@monkeyagent/host";  // host 注入（编译时实现）
export default function Ui() {
  const { call } = useDashboardApi(); // 只返回 { call }
  // 自己 useState + useEffect，不要 useDashboardApi("method", args)
}
```

禁止 UI：`fetch`、secrets、`ctx.llm/bash/mcp`、`window.mini`。

组件：`@monkey-mini-app/ui`（140+ 组件：shadcn L1 + 日期/编辑器/看板/图表产品级）。布局用 **Tailwind classes**（`flex flex-col gap-3`）。`UiProvider` 由 host 编译时自动包裹。组件清单见 `packages/dsh-plugin/skills/monkey-mini-app/references/catalog.md`（`pnpm skill:gen` 自动生成）。

iframe 运行时**完全离线**：`compile-ui.ts` 用 esbuild-wasm 把 `ui.tsx` + react + 用到的组件打包成单个自包含 ESM bundle（tree-shake 按 app 裁剪），不再依赖 esm.sh / sucrase。

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
| `agent(goal, opts?)` | string | dsh：one-shot `agents.create`（见 skill `ctx.md`）；过程流式演进见 [`agent-capability.md`](./agent-capability.md) |

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
| GET | `/ui.css` | @monkey-mini-app/ui 全局样式 |
| GET | `/api/app/:id/ui/entry.js` | per-app UI bundle（编译缓存） |
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

权威 skill 只在 dsh-plugin/skills；`dsh-plugin/src/skills.ts` 仅 resolve 该路径。

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
- **自定义主题**：`~/.monkey-mini-app/themes/theme-<id>.css`（一份文件含 `:root[data-mode="light"]` 与 `dark` 两套 `--xxx` 变量，首行 `/* name: xxx */` 作标题，缺 bg/fg/primary 不认）。host 扫描 → `/api/palettes` 合并（custom:true）→ 前端列表带「自定义」角标（主色淡底小徽章）；iframe 的 runner CSS 自动追加（customPaletteCss）。内置示例：`docs/themes/theme-{crimson,vanta,gold}.css`（暗红 / 纯黑 / 金）。
- **坑**：前端 palette 存原值、应用时 `normalizePalette` 校验（自定义保留、内置 clamp）——`setAppearance`/persist/init/openDashboard 四处都要走它，否则自定义 id 会被 `clampPalette` 转成 default（切不过去）；弹窗列表在 `paintThemePop` 里**重建**（异步加载的自定义才进得来），不能只更新选中态。
- 预览页：`docs/themes-preview.html`（含 Progress 条 + 自定义主题），截图 `docs/themes-preview-{light,dark}.png`。

## Host 列表：三套卡片方案 + monogram + commits

- 卡片方案（`settings` → 卡片方案）：`hero`（渐变字+光晕）/ `etch`（空心描边字）/ `stamp`（线框邮戳，默认）。前端 `state.cardStyle` + `localStorage["mma-card-style"]`，纯前端偏好，不入 host-config。
- monogram：host 端 `acronymOf()` 用 `pinyin-pro` 实时算（中文名前两字声母，英文名取前两字母）；manifest 可选 `acronym` 字段覆盖（见 SKILL.md）。
- commits：`gitCommitCount()`（git rev-list --count HEAD，60s TTL 缓存）——app 无 version 概念，列表 meta 显示「N commits」。
- actions bar 浏览面板：`/api/apps/:id/history[:commit]`（git log + diff-tree numstat + `git show` preview ≤18 行）、`/api/apps/:id/storage[:table]`（动态枚举 storage/*.json）。
- **坑**：esbuild 会把 apply 内后声明的 `appDirOf` 重命名为 `appDirOf2`，但前置定义的 `handleApps` 里引用不会同步重写 → `appDirOf is not defined`。闭包内不要前向引用会被重命名的 const，`handleApps` 自包含定义。
- **坑**：dock 切换（fill/side）模板结构不同（卡 vs 行），`setDock` 必须调 `paintList()` 重渲染，否则样式不切。
- **坑**：改完 `pnpm -r build` 会用旧 src 覆盖 dsh-plugin/lib，务必只跑 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`。

## UI 组件库（2026-08 重写：@monkey-mini-app/ui）

- **来源**：独立 workspace 包 `packages/ui/`（140+ 组件，shadcn v4 + Base UI + recharts/tiptap/CodeMirror/dnd-kit）。构建 `node scripts/build-ui.mjs` → `dist/`（**扁平具名 index** + 源码 + globals.css）。
- **摇树**：dist 的 `index.js` 必须保持**扁平具名 re-export**（`export { Button } from "./src/components/button.tsx"`）——esbuild 对 `export *` 不跨模块摇树，具名 re-export 才会（Button app 产物 63KB vs 全量 2.7MB）。改组件导出名后必须重新 build。
- **编译**：host 端 `compile-ui.ts` 用 esbuild-wasm 打包 ui.tsx（tree-shake + react 打进 bundle + useDashboardApi 虚拟模块注入 + UiProvider 包裹）。esbuild-wasm **不可被打包**（守卫检查），tsup external + dependencies 安装。
- **使用**：`import { Button } from "@monkey-mini-app/ui"`；`import { useDashboardApi } from "@monkeyagent/host"`；布局用 Tailwind classes；**不要**额外 import lucide-react/recharts（库已内置）。
- **分发**：dsh-plugin `workspace:*` 依赖 @monkey-mini-app/ui；本地 profile 安装 `scripts/install-dsh-plugin.sh`（profile pnpm-workspace.yaml 注册仓库 ui 包路径）。发布时 `pnpm publish` 自动转版本号。
- **契约生成**：`pnpm skill:gen` → `scripts/generate-skill.mjs` 用 TS AST 从源码提取 props/类型/JSDoc → `packages/dsh-plugin/skills/monkey-mini-app/references/{catalog.md,contracts/*.md}`。
- **demo**：`apps/demo-host/`（vite :5173 全组件 gallery + Playwright e2e）。

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
