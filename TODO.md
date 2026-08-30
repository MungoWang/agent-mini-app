# TODO — monkey-mini-app

## 当前主线：mini-app 宿主「panel 核心可复用 + react-host」改造（A）

### 已完成（commit）
- `dd51796` templates 重写 + smoke 套件 + ui icons/illustrations + per-app css
- `ff8b884` panel 可复用核心：`createRestPanelHost`(rest.ts) + `createFrameController`(frame.ts) + `createHostShell`(host-shell.ts)，从 dsh 去 dsh 化搬进 panel；加 `onHostChange`；frame `setContainer`
- `ddd117a` apps/react-host：dsh 轻量化替代 SPA，用 panel `createHostShell`/`createRestPanelHost` 起面板（已 Vue/Vite + Chrome 验证：拉 7 模板、点卡片开 iframe、jira 全功能、主题/停靠/设置按钮）

### 核心结论（为什么这么做）
- `PanelHost` 是「唯一接缝」；panel 是纯 React 面板（MiniAppPanel/tabs/actionsbar/list/frames 容器均已在 panel）。
- dsh 里 `DshPanelHost`(REST)/`frame.ts`(iframe 联动)/`http.ts` parse*/`appFrameUrl` 是重复的 rest 逻辑 → 应改由 panel `createRestPanelHost`/`createFrameController` 承担。
- dsh 专属（dock 布局/动画、侧栏/rail 同步、`dshIsDark`、`installFootCss`、origin 发现：`resolveAppsOrigin`/`originFromHostPort`/`writeStoredAppsOrigin`/`APPS_HOST_KEY`/`FALLBACK_HOST_PORT`）留 dsh。

### ⏭️ 未完成 — dsh 去重（step 4）
- [ ] `DshShell` 改用 panel `createHostShell`/`createFrameController`；删 dsh `panel-host.ts`(DshPanelHost)、`client/frame.ts`、`http.ts` 的 parse*、`apps-host.ts` 的 `appFrameUrl`
- [ ] 保 dsh 行为：`DshShell` 的 dock/动画/侧栏/`persistThemeLocal`(setPanelState+applyThemeTo+postEnvAll)/hostPort 迁移(`onHostChange`)
- [ ] 验证：`pnpm --filter @monkey-mini-app/dsh-mini-app build`、`pnpm exec tsc -b`、dsh 测试、**真 dsh web（:3080 UI + :17880 host）逐项验换肤/停靠/iframe/hostPort 迁移**

### 之前已完成（已 stable）
- templates 7 个（minimal/todo/monitor/review/insights/agentrun/jira）+ templates/README.md（指引侧重）+ SKILL 路由
- smoke 套件（S0–S6，在 packages/smoke-test）
- ui 图标(`Icon` ns, lucide) + 插图(`Illu*`, unDraw token 化) + host per-app CSS(P9) + `/files` 字体 + `/` app 索引
- demo-host paradigm TS 错误已修

### 环境备注
- 要看模板效果：`pnpm tsx scripts/demo-templates.mts [port]` → `http://127.0.0.1:<port>/`
- react-host：`cd apps/react-host && pnpm dev`(:5174)，`?host=http://127.0.0.1:17880`；需 host 在跑（demo-templates.mts）
- dsh web 可起：`dsh web --no-open`(:3080)，host :17880；插件 link 到本仓库 `packages/dsh`
- 硬约束：UI 只 import react / @monkey-mini-app/ui / @monkeyagent/host / ./lib；图标 `Icon.*`、插图 `Illu*`；`ctx.tool/llm` 返回 string；MCP args 禁 `{input}`
