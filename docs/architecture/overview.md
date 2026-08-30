# 现行架构概览

> 真源（短）。细节契约见 `docs/contracts/`；agent 改码入口见根 `AGENTS.md`。

## 包面

| Package | npm | 角色 |
|---------|-----|------|
| `packages/host` | `@monkey-mini-app/host` | AppsManager / GitHistory / Hono / UiCompiler / ToolFacade / config |
| `packages/panel` | `@monkey-mini-app/panel` | 纯 React 面板（`PanelHost` 接缝，无 `/api`） |
| `packages/dsh` | `@monkey-mini-app/dsh-mini-app` | dsh 插件：capabilities + lifecycle + client + skills |
| `packages/ui` | `@monkey-mini-app/ui` | 组件库（host 编译 UI 时依赖） |
| `packages/smoke-test` | — | 集成 / 样例冒烟 |

依赖方向（eslint 强制）：`host` ↛ `panel`/`dsh`；`panel` ↛ `host`/`dsh`；`dsh` → `host` + `panel`。

## 组合根

```ts
createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), { config }).apply(ctx)
```

- **HostCapabilities**：`caps.*(callCtx, …)`，作者侧经 `bindCapsToContext` 变成 `ctx.bash` / `llm` / `agent` / …
- **HostLifecycle**：注册 `mini_app_*` 工具、安装 skill、provide 服务
- **PanelHost**：client 侧面板 adapter（fetchApps / persistTheme / frame …）

## 运行时布局

`WorkspacePaths` 唯一拼路径。典型：`~/.monkey-mini-app/runtime/{host.json,apps/...}`。  
插件首启对**缺失**的 `host.json` 自动 bootstrap 写完整缺省（无 `runtimeRoot`/`hostPort` 即用默认值）；对**已存在但损坏**的文件 fail loud。

## 安装

```bash
bash scripts/install-dsh-mini-app.sh
dsh web --no-open   # :3080 ；apps host 默认 :17880
```

## UI 编译

host 用 esbuild（native，wasm fallback）把每个 app 的 `ui.tsx` 打成自包含 ESM；iframe 内不再编译。

## 已删除的旧栈

`host-core` / `panel-core` / `dsh-plugin` 已从 main 移除。恢复：

```bash
git checkout archive/pre-cutover-legacy-2026-08-29 -- packages/host-core
```

历史叙述见 `docs/archive/`。
