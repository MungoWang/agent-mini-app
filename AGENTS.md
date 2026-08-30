# AGENTS.md

本仓库给 **Grok CLI / 其他 coding agent** 用。先读设计契约，再改代码。

- **当前 foundation（并行新栈）**：[`docs/superpowers/specs/2026-08-29-mma-next-foundation-design.md`](docs/superpowers/specs/2026-08-29-mma-next-foundation-design.md)
- **历史踩坑 / 旧栈契约**：[`docs/context.md`](docs/context.md)
- **旧 host-core 大纲**（cutover 前仍有效）：[`docs/host-architecture.md`](docs/host-architecture.md)
- **PI extension port（调研，未实现）**：[`docs/pi-extension-port.md`](docs/pi-extension-port.md)
- **`ctx.agent` 契约与流式演进**：[`docs/agent-capability.md`](docs/agent-capability.md)

网页 Grok 沙箱 ≠ 本机仓库。在本机目录改文件，改完重启 dsh web，硬刷新浏览器。

## 改哪里

产品面现在是 **新三包 + ui + smoke-test**，旧三包并行保留直到 cutover（不要删）。

| 目标 | 文件 |
|------|------|
| **host 能力（Host / AppsManager / GitHistory / Hono / UI 编译 / tools）** | `packages/host/src/` |
| **纯 React 面板（PanelHost，无 `/api`）** | `packages/panel/src/` |
| dsh 插件 + client + skills | `packages/dsh/`（npm：`@monkey-mini-app/dsh-mini-app`） |
| dsh 侧栏入口、tabs、side panel、主题、加载态 | `packages/dsh/src/client/` |
| 生成 app 的说明书 | **唯一源** `packages/dsh/skills/monkey-mini-app/`（SKILL.md + references/ + templates/） |
| UI 组件库（`@monkey-mini-app/ui`，140+ 组件） | `packages/ui/`（构建：`node scripts/build-ui.mjs` → dist） |
| 组件库 skill 契约（自动生成） | `scripts/generate-skill.mjs` → `pnpm skill:gen` |
| 组件库 demo gallery | `apps/demo-host/`（`pnpm --filter demo-host dev` :5173） |
| 本地安装到 dsh web profile | `scripts/install-dsh-mini-app.sh`（bootstrap `host.json` + path link） |
| 设计 / 门禁 | [`docs/superpowers/specs/2026-08-29-mma-next-foundation-design.md`](docs/superpowers/specs/2026-08-29-mma-next-foundation-design.md) |

`packages/dsh/lib/` 是 tsup 产物（gitignore）。改完 `pnpm --filter @monkey-mini-app/dsh-mini-app build`，重启 dsh web，硬刷新浏览器。

### Legacy parallel（cutover 前不要删、不要当默认入口）

| 旧包 | 角色 |
|------|------|
| `packages/host-core` | 旧 agent-agnostic host（`createHost(adapter)`） |
| `packages/panel-core` | 旧纯 React 面板 |
| `packages/dsh-plugin` | 旧 dsh 壳；旧安装脚本 `scripts/install-dsh-plugin.sh` |

cutover 后才会删除旧包并切默认安装。在此之前两套并存；**新代码写进 `host` / `panel` / `dsh`**。

## 架构（2026-08-29 foundation）

- **新栈**：`panel`（纯 React，`PanelHost` 接缝）← `dsh-mini-app` → `host`（`createHost(capabilities, lifecycle, { config })` + AppsManager / GitHistory / Hono HttpGateway / UiCompiler / ToolFacade）。`ui` 仅 host 编译 UI 时依赖。
- **依赖方向（eslint 强制）**：`host` 禁止 import `panel` / `dsh`；`panel` 禁止 import `host` / `dsh`。
- **路径**：只有 `WorkspacePaths` 拼 runtime 布局。业务代码禁止写 `~/.monkey-mini-app`（eslint + 单测；允许 `packages/host/src/config/defaults.ts` 与 `bootstrap.ts`）。
- **配置**：install / `scripts/mma-init.ts` 用 `bootstrapHostConfig` 写完整 `host.json`。运行时 `loadHostConfig` **fail loud**，不 `theme ?? 'light'`。
- **接缝命名**：`HostCapabilities` / `HostLifecycle` / `PanelHost`（不要再加 `Adapter` 主接缝）。
- **组合根**：dsh `apply` = `createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), { config }).apply(ctx)`。
- **git**：产品代码全部 `isomorphic-git`（`packages/host/src/git/git-history.ts`），禁止 `child_process` git CLI。
- **UI 运行时**：host 用 esbuild（native，wasm fallback）把 `ui.tsx` 打成单个 ESM bundle。
- **协议桥**：`useDashboardApi` 从 `@monkeyagent/host` import（编译时注入），`call(method, args)` → `/api/call`。
- **i18n**：host 与 panel 各自 i18next + `locales/`；缺 key 非 production 抛错。
- **主题**：panel `PALETTES` / `applyThemeTo`；runner 同步 `data-theme` / `.dark`。
- **安装**：`bash scripts/install-dsh-mini-app.sh` 构建 ui + dsh bundle，把 `host`/`panel`/`ui` 链进 dsh web profile，bootstrap 写 `host.json`。

旧栈（`panel-core` ← `host-core` ← `dsh-plugin`）仍在仓库里，架构说明见 `docs/host-architecture.md`。

## 硬约束（违反即坏 app）

1. UI 禁止 `import main.api.ts`。只许 `useDashboardApi()` → `{ call(method, args) }`。
2. `call` 的 method 必须是 `defineDashboard({ api })` 的键。
3. 后端可 `import "./lib/..."`，不可 npm / Node 内置。抓网用 `ctx.http`，本机命令用 `ctx.bash`，模型用 `ctx.llm`。
4. `compileAppSource` 用 sucrase，**禁止**正则全局剥 `: type`。UI 编译在 `packages/host/src/compile/ui-compiler.ts`，**禁止**把 ui 代码塞回浏览器内编译。
5. `ctx.llm` 走 dsh **`llm.stream({ provider, model, messages })`**，不要假设没 key 就不能用。
6. `ctx.http` 返回 `{ ok, status, headers, text, json }`；`ctx.bash` 返回 `{ stdout, stderr, exitCode }`；`ctx.llm` / `ctx.tool` 返回 **string**。MCP args 禁止 `{ input: "..." }`。
7. iframe 必须撑满高度；`#root.boot` 只用于加载插画，React mount 前清掉。
8. 小程序入口跟「设置」同一套折叠 class（`*_collapsed`），点入口用 `data-mma-open` 事件委托，不要混用另一份 React。
9. 组件库 dist 的 `index.js` 是**扁平具名 re-export**（esbuild 摇树的必要条件），改组件导出名后必须重新 `node scripts/build-ui.mjs`。
10. esbuild-wasm 有「不可打包」守卫，**必须 external**（dsh `tsup.config.ts` external 已配），运行时靠 dependencies 安装。
11. 运行时不发明 `host.json` 缺省字段；缺文件要提示跑 `scripts/install-dsh-mini-app.sh` 或 `pnpm exec tsx scripts/mma-init.ts`。

## 交付门禁

逻辑代码改完必须先跑 UT + coverage（新三包 lines ≥85%）+ lint，通过后再给 zip / 让用户替换。不要先丢半成品。

```bash
pnpm lint
pnpm test
pnpm test:coverage
```

## 验证

```bash
pnpm lint
node --check packages/dsh/lib/index.js
node --check packages/dsh/lib/client.js
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

本地安装：`bash scripts/install-dsh-mini-app.sh`，重启 dsh web，硬刷新。

打开「小程序」：列表、打开 Todo、侧栏折叠藏字、钉到右侧、加载后内容不被裁成一条缝。

## 生成新 mini app

按 skill 写 `manifest.json` + `ui.tsx` + `main.api.ts`（+ `lib/`）。UI 组件从 `@monkey-mini-app/ui` import（看 `references/catalog.md` 选组件），`useDashboardApi` 从 `@monkeyagent/host` import，布局用 Tailwind classes。样例：`templates/hello`、`todo`、`sysmon`、`news`（`ctx.http` RSS + `./lib` + `ctx.llm` schema）。

改 skill 或协议时同步更新 `docs/context.md` 与 foundation spec。
