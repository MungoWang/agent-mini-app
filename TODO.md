# TODO

只列**当前在做**或**已决定要做但还没开工**的事。做完搬去 `docs/archive/tasks/<short-desc>-<YYYY-MM-DD>.md`（加归档日期 + 原位置，规则见 `AGENTS.md` → Doc rules），不在这里留「已落地」清单。

优先级读法：**P1** = 功能工作，有先后 · **P2** = 质量，随时可捡 · **触发式** = 已决定只在条件出现时开工（判据在 RFC，别凭手感启动）。

> 2026-09-08：原 P0 三条（CI 跑 `tsc -b`、没有 gate 跑 Playwright、CI 少 `check:format` /
> `check:templates`）已做完，记录见
> [`docs/archive/tasks/ci-gate-parity-2026-09-08.md`](docs/archive/tasks/ci-gate-parity-2026-09-08.md)。
> Playwright 按机主决定继续只在本地跑，口径写在 `AGENTS.md` → Gates。
>
> 2026-09-13：Looks + 门面 + 液态玻璃（`glass-island` / `today`）+ host 首屏 bake local `theme.css`
> 已落地，记录见
> [`docs/archive/tasks/looks-liquid-glass-2026-09-13.md`](docs/archive/tasks/looks-liquid-glass-2026-09-13.md)。
> P1 只剩 Look light/dark PNG（机主手截）。
>
> 2026-09-10：P1「layout presets」六个 preset 全部落地（组件 + 断言其存在理由的契约测试 +
> 画廊示例 + `gen:skill`），逐条踩坑与 canary 记录见
> [`docs/archive/tasks/layout-presets-2026-09-10.md`](docs/archive/tasks/layout-presets-2026-09-10.md)。
> 同一版里定了换壳：`watch` → `DashboardShell` 已做；`sheets` **不换** `TablePage`——它的网格本就在
> `ListDetail` 的 detail 栏里，再包一层是嵌套滚动，正是这族要消灭的东西。下面的编号因此前移一位。
>
> 2026-09-08：「AI 风向雷达」实战报告里的问题已修完一轮（`f3a026a` `afe6b29` `8f8ad0f` `4ab5b37`
> + 本次 storage）：CSS 缓存永不失效、`reload` 不告诉 agent 清了啥、`view_eval` 把慢报成卡死、
> `llm + schema` 的 1024 默认值与不保证解析、`sheet/dialog` 隐藏宽度锁、事件名口口相传、
> `ctx.storage` 非原子写 + 坏文件静默清空。存储这一条的设计取舍见
> [`docs/archive/tasks/storage-layout-2026-09-08.md`](docs/archive/tasks/storage-layout-2026-09-08.md)；
> 机主明确不做的：`ctx.job()`、独立 `llmJson` 工具、e2e 进 CI。

---

## P1 — 功能工作，按依赖排序

1. **Look 预览图** — looks / 门面 / 液态玻璃已归档
   （[`looks-liquid-glass-2026-09-13.md`](docs/archive/tasks/looks-liquid-glass-2026-09-13.md)）。
   **只剩**：每个 Look 的 light / dark PNG（机主手截 demo-host 的 Looks 栏），
   `catalog.json` 的 `preview` 位已留；截完接到 `references/looks/index.md` 的生成器。

## P2 — 质量，无先后

2. **`shared/**` 的「纯同构」只是约定，没有静态门禁。**
   `layerOfRel`（`packages/host/src/compile/static-check.ts:147`）只把 findings **按层归类**，没有任何规则拦 `shared/` 里的 React / `ctx` / DOM / Node import。而 `AGENTS.md` → Hard constraints (3) 说的是「双向强制」。
   做法：按层加一条 import specifier 规则 + 植入 canary 证明它会红。

3. **kit 测试没有覆盖率阈值。**
   `vitest.config.ts:32-35` 的 `lines: 85` 只覆盖 `host` / `panel` / `dsh`，`packages/ui` 没有地板——那批 `.test.tsx` 只要再一次和 include 规则错开，没人报警。`kit` project 已经接进 workspace（`vitest.workspace.ts:43`），缺的就是阈值这半边。

4. **`packages/panel/src/host-shell.ts` 是全仓最低覆盖：81.4 % lines / 64.1 % branch。**
   panel 的阈值是聚合 glob，被同目录别的文件抬着过线，所以没人察觉。纯补测试，与功能无关。

## 触发式 — 条件出现才开工

| 事项 | 开工条件 | 判据出处 |
|---|---|---|
| 额外包的 approve/reject 弹窗 | **只在**出现分享/安装别人的包时，而且打在那份包上；本机自用的 app 不加围栏 | `docs/rfcs/per-app-packages.md` §7 |
| backend worker / 子进程隔离 | 某个 app 的 native 依赖真的把宿主拖崩过一次 | 同上 §4 |
| `mini_app_view_eval` 观测指标 | 第二次出现「不知道该不该改形态」的争论，或 `view` 非 live > 5 % | `docs/rfcs/view-eval-metrics.md` |
| 查询型存储（SQLite / `node:sqlite` / WASM SQLite） | 面板「表过大」提醒 + 分表引导之后仍出现真实需求：要按条件过滤/排序/聚合，或单表大到 JSON 整表重写可测地拖慢。**前置条件**：接受 WASM 依赖，或把 `engines.node` 抬到 ≥22.5 用内置 `node:sqlite`。自动按 key 拆文件已撤回（实测常见形状更慢） | `docs/archive/tasks/storage-layout-2026-09-08.md` |
