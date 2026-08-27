# AGENTS.md

本仓库给 **Grok CLI / 其他 coding agent** 用。先读 `docs/context.md`（完整契约与踩坑），再改代码。

网页 Grok 沙箱 ≠ 本机仓库。在本机目录改文件，改完重启 dsh web，硬刷新浏览器。

## 改哪里

| 目标 | 文件 |
|------|------|
| dsh 侧栏入口、tabs、side panel、主题、加载态 | `packages/dsh-plugin/src/client.ts` |
| host :17880、loader、ctx、LLM、runner HTML | `packages/dsh-plugin/src/index.ts` |
| **host 端 UI 编译（esbuild-wasm per-app bundle）** | `packages/dsh-plugin/src/compile-ui.ts` |
| UI 组件库（`@monkey-mini-app/ui`，140+ 组件） | `packages/ui/`（构建：`node scripts/build-ui.mjs` → dist） |
| 组件库 skill 契约（自动生成） | `scripts/generate-skill.mjs` → `pnpm skill:gen` |
| 组件库 demo gallery | `apps/demo-host/`（`pnpm --filter demo-host dev` :5173） |
| 生成 app 的说明书 | **唯一源** `packages/dsh-plugin/skills/monkey-mini-app/`（SKILL.md + references/ + templates/） |
| 设计/历史决策 | `docs/context.md` |

`lib/` 是 tsup 产物（gitignore）。改完 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`，重启 dsh web，硬刷新浏览器。

## 架构（2026-08 重写后）

- **UI 运行时**：iframe 里不再有浏览器内编译。host 用 **esbuild-wasm** 把 `ui.tsx` + 用到的组件打包成**单个自包含 ESM bundle**（react + 组件 + useDashboardApi 全部打进，tree-shake 按 app 裁剪，产物几十 KB ~ 1MB）。
- **组件库** `@monkey-mini-app/ui` 是独立 npm workspace 包（exports 指 dist：扁平具名 index + 源码 + globals.css），dsh-plugin 以 `workspace:*` 依赖它。改组件库 → `node scripts/build-ui.mjs`（生成扁平 index，让 esbuild 能摇树）。
- **协议桥**：`useDashboardApi` 从 `@monkeyagent/host` import（编译时注入完整实现），`call(method, args)` → `/api/call`。
- **主题**：host 注入 CSS 变量（`themes.ts`，data-theme/data-palette），runner 同步 `.dark` class。
- **UI 打包分发**：dsh-plugin 是 npm 包，`@monkey-mini-app/ui` 是它的 dependencies；本地 profile 安装靠 `scripts/install-dsh-plugin.sh`（profile workspace 注册仓库 ui 包路径 + `pnpm add -w`）。

## 硬约束（违反即坏 app）

1. UI 禁止 `import main.api.ts`。只许 `useDashboardApi()` → `{ call(method, args) }`。
2. `call` 的 method 必须是 `defineDashboard({ api })` 的键。
3. 后端可 `import "./lib/..."`，不可 npm / Node 内置。抓网用 `ctx.http`，本机命令用 `ctx.bash`，模型用 `ctx.llm`。
4. `compileAppSource` 用 sucrase，**禁止**正则全局剥 `: type`。UI 编译在 `compile-ui.ts`（esbuild-wasm），**禁止**把 ui 代码塞回浏览器内编译。
5. `ctx.llm` 走 dsh **`llm.stream({ provider, model, messages })`**，不要假设没 key 就不能用。
6. `ctx.http` 返回 `{ ok, status, headers, text, json }`；`ctx.bash` 返回 `{ stdout, stderr, exitCode }`；`ctx.llm` / `ctx.tool` 返回 **string**。MCP args 禁止 `{ input: "..." }`。
7. iframe 必须撑满高度；`#root.boot` 只用于加载插画，React mount 前清掉。
8. 小程序入口跟「设置」同一套折叠 class（`*_collapsed`），点入口用 `data-mma-open` 事件委托，不要混用另一份 React。
9. 组件库 dist 的 `index.js` 是**扁平具名 re-export**（esbuild 摇树的必要条件），改组件导出名后必须重新 `node scripts/build-ui.mjs`。
10. esbuild-wasm 有「不可打包」守卫，**必须 external**（`tsup.config.ts` external 已配），运行时靠 dependencies 安装。

## 交付门禁

逻辑代码改完必须先跑 UT + smoke，通过后再给 zip / 让用户替换。不要先丢半成品。

## 验证

```bash
node --check packages/dsh-plugin/lib/index.js
node --check packages/dsh-plugin/lib/client.js
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

打开「小程序」：列表、打开 Todo、侧栏折叠藏字、钉到右侧、加载后内容不被裁成一条缝。

## 生成新 mini app

按 skill 写 `manifest.json` + `ui.tsx` + `main.api.ts`（+ `lib/`）。UI 组件从 `@monkey-mini-app/ui` import（看 `references/catalog.md` 选组件），`useDashboardApi` 从 `@monkeyagent/host` import，布局用 Tailwind classes。样例：`templates/hello`、`todo`、`sysmon`、`news`（`ctx.http` RSS + `./lib` + `ctx.llm` schema）。

改 skill 或协议时同步更新 `docs/context.md`。
