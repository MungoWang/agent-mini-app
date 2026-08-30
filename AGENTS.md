# AGENTS.md

本仓库给 **Grok CLI / 其他 coding agent** 用。

1. 先读 **[`docs/README.md`](docs/README.md)**（文档纪律 + 索引）。
2. 改码看下表；生成 mini-app 看 skill：`packages/dsh/skills/monkey-mini-app/`。

网页 Grok 沙箱 ≠ 本机仓库。在本机目录改文件，改完 `pnpm --filter @monkey-mini-app/dsh-mini-app build`，重启 dsh web，硬刷新浏览器。

## 文档纪律（必守）

- 架构 → `docs/architecture/`；契约 → `docs/contracts/`；未落地调研 → `docs/rfcs/`。
- **禁止**在仓库根或 `docs/` 根新建长文（仅 `docs/README.md` 例外）。
- `docs/archive/**` 只读，不作实现依据。
- Skill 实现契约以 `packages/dsh/skills/monkey-mini-app/` 为唯一源。

## 改哪里

| 目标 | 文件 |
|------|------|
| host 能力（AppsManager / Git / Hono / UI 编译 / tools） | `packages/host/src/` |
| 纯 React 面板（PanelHost） | `packages/panel/src/` |
| dsh 插件 + client + skills | `packages/dsh/`（npm：`@monkey-mini-app/dsh-mini-app`） |
| 生成 app 的说明书 | `packages/dsh/skills/monkey-mini-app/` |
| UI 组件库 | `packages/ui/` → `node scripts/build-ui.mjs` |
| 组件库 skill 契约 | `scripts/generate-skill.mjs` → `pnpm skill:gen` |
| demo gallery | `apps/demo-host/`（`:5173`） |
| 安装到 dsh web profile | `scripts/install-dsh-mini-app.sh` |
| 现行架构说明 | `docs/architecture/overview.md` |

`packages/dsh/lib/` 是 tsup 产物（gitignore）。

## 架构要点

- 组合根：`createHost(DshCapabilities, DshLifecycle, { config }).apply(ctx)`。
- 接缝名：`HostCapabilities` / `HostLifecycle` / `PanelHost`（不要再加 `Adapter` 主接缝）。
- `HostCapabilities.*(callCtx, …)`；`bindCapsToContext` → 作者 `ctx.*`；opts 不 merge。
- 路径只经 `WorkspacePaths`；业务代码禁止硬编码 `~/.monkey-mini-app`。
- 配置：install / `mma-init` 写完整 `host.json`；运行时 `loadHostConfig` fail loud。
- git：产品代码 `isomorphic-git`（`packages/host/src/git/`），禁止 `child_process` git CLI。
- UI：host esbuild 打单文件 ESM；iframe 内不编译。
- 旧包已删；快照 tag：`archive/pre-cutover-legacy-2026-08-29`。

## 硬约束（违反即坏 app）

1. UI 只许 `import`：`react(-dom)` / `lucide-react` / `@monkey-mini-app/ui` / `@monkeyagent/host` / 相对 `./lib`。**禁止** `main.api.ts`、以及其它 npm 包（app 目录在 `~/.monkey-mini-app/runtime/apps/<id>`，无 node_modules；ui-compiler 只特判这些 + 相对路径）。调用接口只用 `useDashboardApi()` → `{ call(method, args) }`。
   - 图标：`import { Icon } from "@monkey-mini-app/ui"` 后 `<Icon.HelpCircle />`（去掉了直接 import lucide —— 一律从 ui 拿，命名空间）。
   - 插图：`@monkey-mini-app/ui` 导出 `IlluXxx` 空状态场景（unDraw 源，免费/MIT；`scripts/vendor-undraw.mjs` 已把固定调色板 token 化：accent→`--primary`、灰阶→`--muted`/`--card`等），勿硬编码 hex；强调色由 `--primary-svg-color: var(--primary)` 控制。
2. `call` 的 method 必须是 `defineDashboard({ api })` 的键。
3. 后端可 `import "./lib/..."`，不可 npm / Node 内置。网：`ctx.http`；本机：`ctx.bash`；模型：`ctx.llm`。
4. `compileAppSource` 用 sucrase，禁止正则全局剥 `: type`。UI 编译在 `packages/host/src/compile/ui-compiler.ts`。
5. `ctx.llm` 走 dsh `llm.stream({ provider, model, messages })`。
6. `ctx.http` → `{ ok, status, headers, text, json }`；`ctx.bash` → `{ stdout, stderr, exitCode }`；`ctx.llm` / `ctx.tool` → **string**。MCP args 禁止 `{ input: "..." }`。
7. iframe 必须撑满高度；`#root.boot` 只用于加载插画，React mount 前清掉。
8. 小程序入口与「设置」同一套折叠 class；点入口用 `data-mma-open` 事件委托。
9. 组件库 dist `index.js` 须为扁平具名 re-export；改导出名后重跑 `node scripts/build-ui.mjs`。
10. esbuild-wasm 不可打包的依赖必须 external（dsh `tsup.config.ts` 已配）。
11. 运行时不发明 `host.json` 缺省字段；缺文件提示跑 install / `mma-init`。

## 代码风格（eslint，可 autofix）

`packages/host|panel|dsh` 统一：

- 双引号 + 分号
- `import type { … }` 与值 import 分开（`consistent-type-imports`）
- import 分组排序（`node:` → 外部包 → `@monkey-*` → 相对路径）

```bash
pnpm lint:fix   # 自动修引号 / 分号 / import
pnpm lint
```

## 开发 vs 发布（哪些脚本什么时候跑）

**开发时跑（不进发布链路）**：`pnpm test` / `test:coverage` / `lint` / `lint:fix` / `typecheck` / `build` / `build:ui` / `skill:gen` / `smoke`。`scripts/vendor-undraw.mjs`（重下插图）只在改插图源时手动跑，**绝不进发布**。

**发布时跑（已 hook 到 npm 生命周期，不用记）**：
- `pnpm publish`（根私有，只作编排）= `publish:prep`（`build:ui` → `skill:gen` → `build`）+ `pnpm -r publish`（按依赖拓扑序：ui 先于 dsh）。
- 单包也得对：`@monkey-mini-app/ui` 的 `prepack` 已 build-ui；`@monkey-mini-app/dsh-mini-app` 的 `prepublishOnly` 会先 build ui、再 `skill:gen` 同步 skill 文档、再 tsup 打 lib —— 因为 `skills/` 是发布内容，ui 组件变了必须同步。
- `@monkey-mini-app/host` 无 build（`exports` 直指源 TS，消费方打包器转译），无需 hook。

## 交付门禁

```bash
pnpm lint
pnpm test
pnpm test:coverage   # host/panel/dsh lines ≥85%
pnpm exec tsc -b
pnpm --filter @monkey-mini-app/dsh-mini-app build
```

`tsc -b` 覆盖 `src` **和** `tests`（根 `tsconfig.json` + 各包 `tsconfig.json` 的 `include` 都含 `tests`，host/panel 的 `rootDir` 已改为 `.`）。
**禁止**再往 exclude 里塞 `**/*.test.ts`：测试文件一旦不属于任何 tsconfig，编辑器会退回 inferred project（默认非 strict）单独检查，结果就是「IDE 飘红、门禁全绿」两边对不上。报「类型全绿」前先确认跑的是根 `pnpm exec tsc -b`。

## 验证

```bash
node --check packages/dsh/lib/index.js
node --check packages/dsh/lib/client.js
curl -s http://127.0.0.1:17880/api/apps
```

打开「小程序」：列表、打开 Todo、侧栏折叠、钉到右侧、内容不被裁成一条缝。

## 生成新 mini app

按 skill 写 `manifest.json` + `ui.tsx` + `main.api.ts`（+ `lib/`）。组件从 `@monkey-mini-app/ui` import，`useDashboardApi` 从 `@monkeyagent/host` import。样例：skill `templates/`。

改协议时同步 `docs/contracts/` 与 skill。
