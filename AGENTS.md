# AGENTS.md

本仓库给 **Grok CLI / 其他 coding agent** 用。先读 `docs/context.md`（完整契约与踩坑），再改代码。

网页 Grok 沙箱 ≠ 本机仓库。在本机目录改文件，改完重启 dsh web，硬刷新浏览器。

## 改哪里

| 目标 | 文件 |
|------|------|
| dsh 侧栏入口、tabs、side panel、主题、加载态 | `packages/dsh-plugin/src/client.ts` |
| host :17880、loader、ctx、LLM、runner HTML | `packages/dsh-plugin/src/index.ts` |
| 组件袋 | `packages/dsh-plugin/src/ui-kit.ts` |
| 生成 app 的说明书 | **唯一源** `packages/dsh-plugin/skills/monkey-mini-app/`（SKILL.md + references/ + templates/） |
| 设计/历史决策 | `docs/context.md` |

只改 `packages/dsh-plugin/src/**/*.ts`。`lib/` 是 tsup 产物（gitignore）。改完 `pnpm --filter @monkey-mini-app/dsh-monkey-mini-app build`，重启 dsh web，硬刷新浏览器。

## 硬约束（违反即坏 app）

1. UI 禁止 `import main.api.ts`。只许 `useDashboardApi()` → `{ call(method, args) }`。
2. `call` 的 method 必须是 `defineDashboard({ api })` 的键。
3. 后端可 `import "./lib/..."`，不可 npm / Node 内置。抓网用 `ctx.http`，本机命令用 `ctx.bash`，模型用 `ctx.llm`。
4. `compileAppSource` 用 sucrase，**禁止**正则全局剥 `: type`。`appRunnerHtml` 内联脚本必须是浏览器 JS，不能写 `as Type`。不要把 `defineDashboard` 再当 `new Function` 参数。
5. `ctx.llm` 走 dsh **`llm.stream({ provider, model, messages })`**，不要假设没 key 就不能用。
6. `ctx.http` 返回 `{ ok, status, headers, text, json }`；`ctx.bash` 返回 `{ stdout, stderr, exitCode }`；`ctx.llm` / `ctx.tool` 返回 **string**。MCP args 禁止 `{ input: "..." }`。
7. iframe 必须撑满高度；`#root.boot` 只用于加载插画，React mount 前清掉。
8. 小程序入口跟「设置」同一套折叠 class（`*_collapsed`），点入口用 `data-mma-open` 事件委托，不要混用另一份 React。

## 交付门禁

逻辑代码改完必须先跑 UT + smoke，通过后再给 zip / 让用户替换。不要先丢半成品。

## 验证

```bash
node --check packages/dsh-plugin/lib/client.js
node --check packages/dsh-plugin/lib/index.js
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

打开「小程序」：列表、打开 Todo、侧栏折叠藏字、钉到右侧、加载后内容不被裁成一条缝。

## 生成新 mini app

按 skill 写 `manifest.json` + `ui.tsx` + `main.api.ts`（+ `lib/`）。样例：`templates/hello`、`todo`、`sysmon`、`news`（`ctx.http` RSS + `./lib` + `ctx.llm` schema）。

改 skill 或协议时同步更新 `docs/context.md`。
