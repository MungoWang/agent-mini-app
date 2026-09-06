# TODO

只列**当前在做**或**已决定要做但还没开工**的事。做完搬去 `docs/archive/tasks/<short-desc>-<YYYY-MM-DD>.md`（加归档日期 + 原位置，规则见 `AGENTS.md` → Doc rules），不在这里留「已落地」清单。

优先级读法：**P1** = 功能工作，有先后 · **P2** = 质量，随时可捡 · **触发式** = 已决定只在条件出现时开工（判据在 RFC，别凭手感启动）。

> 2026-09-08：原 P0 三条（CI 跑 `tsc -b`、没有 gate 跑 Playwright、CI 少 `check:format` /
> `check:templates`）已做完，记录见
> [`docs/archive/tasks/ci-gate-parity-2026-09-08.md`](docs/archive/tasks/ci-gate-parity-2026-09-08.md)。
> Playwright 按机主决定继续只在本地跑，口径写在 `AGENTS.md` → Gates。

---

## P1 — 功能工作，按依赖排序

1. **layout presets** — `docs/rfcs/authoring-surface.md` §4（workstream 2），**进行中 1/6**。
   已落：`ListDetail`（§4.2 顺序 1，S1/S6）— `packages/ui/src/blocks/list-detail.tsx` + 5 条
   jsdom 类契约测试 + `apps/demo-host/e2e/list-detail.spec.ts`（浏览器里证明两栏各自滚、toolbar
   不动，canary 验过：去掉 `overflow-y-auto` 它就红）+ `list-detail-01` 示例 + `listDetail` 中英
   label + 合同已 `gen:skill`。
   待做（按 §4.2 顺序）：`TablePage` → `DashboardShell` → `SettingsSplit` → `WizardShell` → `FormSheet`；
   每个都要齐这四件：组件、断言该 preset 存在理由的测试、一条 `@scenario` 不重复的示例、`pnpm gen:skill`。
   顺手修掉的两个真 bug（都是这一族带出来的）：
   • `components/resizable.tsx` 的 `@example` 教的是 `direction="horizontal"`，而装的是
     react-resizable-panels v4（prop 叫 `orientation`）——生成的合同一直在教 agent 写一个不存在的属性；
   • `hooks/use-mobile.ts` 在无 `matchMedia` 的环境（SSR / 裸 jsdom）直接抛，任何用 `Sidebar` 的
     渲染都会炸；现在按「未知即宽屏」返回 false。
   被谁挡：没有。**它挡住**：第 2 项。

2. **templates / paradigms 按 presets 重做** — 同一 RFC §8 步骤 5。等第 1 项落地再动，否则写两遍。

## P2 — 质量，无先后

3. **`shared/**` 的「纯同构」只是约定，没有静态门禁。**
   `layerOfRel`（`packages/host/src/compile/static-check.ts:147`）只把 findings **按层归类**，没有任何规则拦 `shared/` 里的 React / `ctx` / DOM / Node import。而 `AGENTS.md` → Hard constraints (3) 说的是「双向强制」。
   做法：按层加一条 import specifier 规则 + 植入 canary 证明它会红。

4. **kit 测试没有覆盖率阈值。**
   `vitest.config.ts:32-35` 的 `lines: 85` 只覆盖 `host` / `panel` / `dsh`，`packages/ui` 没有地板——那批 `.test.tsx` 只要再一次和 include 规则错开，没人报警。`kit` project 已经接进 workspace（`vitest.workspace.ts:43`），缺的就是阈值这半边。

5. **`packages/panel/src/host-shell.ts` 是全仓最低覆盖：81.4 % lines / 64.1 % branch。**
   panel 的阈值是聚合 glob，被同目录别的文件抬着过线，所以没人察觉。纯补测试，与功能无关。

## 触发式 — 条件出现才开工

| 事项 | 开工条件 | 判据出处 |
|---|---|---|
| 额外包的 approve/reject 弹窗 | **只在**出现分享/安装别人的包时，而且打在那份包上；本机自用的 app 不加围栏 | `docs/rfcs/per-app-packages.md` §7 |
| backend worker / 子进程隔离 | 某个 app 的 native 依赖真的把宿主拖崩过一次 | 同上 §4 |
| `mini_app_view_eval` 观测指标 | 第二次出现「不知道该不该改形态」的争论，或 `view` 非 live > 5 % | `docs/rfcs/view-eval-metrics.md` |
