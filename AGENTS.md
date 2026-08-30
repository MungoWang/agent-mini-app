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

1. UI 禁止 `import main.api.ts`。只许 `useDashboardApi()` → `{ call(method, args) }`。
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

## 交付门禁

```bash
pnpm lint
pnpm test
pnpm test:coverage   # host/panel/dsh lines ≥85%
pnpm exec tsc -b
pnpm --filter @monkey-mini-app/dsh-mini-app build
```

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
