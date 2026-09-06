# TODO

只列**当前在做**或**已决定要做但还没开工**的事。做完就搬去 `docs/archive/tasks/<short-desc>-<date>.md`（规则见 `AGENTS.md` → Doc rules）。

---

## 在做

- **layout presets**（`docs/rfcs/authoring-surface.md` §4）：场景与清单已定（§4.1 / §4.2，6 个，按 build order 排），**未开工**。判据已作废，理由见 §4.0。

## 已落地

- **motion**：`/mma/vendors/motion.js` + kit `Reveal`（2026-09-06）。vendor 表加了 `targets` 轴（motion 仅 UI，后端 `BACKEND_IMPORT`），`styling.md` Animation 同条 commit 重写。见 §3.1。

## 已排期，等触发条件（判据都在 RFC 里，别凭手感启动）

| 事项 | 开工条件 | 依据 |
|---|---|---|
| templates / paradigms 重做 | 必须排在 presets 之后，不然重写两遍 | `docs/rfcs/authoring-surface.md` §8 步骤 5 |
| 额外包的 approve/reject 弹窗 | **只在出现分享/安装别人的包时**，而且打在包上，不给本机自用的 app 加围栏 | `docs/rfcs/per-app-packages.md` §7 |
| backend worker / 子进程隔离 | 某个 app 的 native 依赖真的把宿主拖崩过一次 | 同上 §4 |
| `mini_app_view_eval` 观测指标 | 第二次出现「不知道该不该改形态」的争论，或 `view` 非 live > 5% | `docs/rfcs/view-eval-metrics.md` |

## 挂起（低优先，随时可捡）

- **kit 测试没有覆盖率门槛**。`packages/ui` 的组件测试之前根本没被 `pnpm test` 跑到（见 `vitest.workspace.ts` 的 `kit` project 注释），根因之一是 85% 线只覆盖 host/panel/dsh。project 已经接上，但 kit 自身不设阈值——24 个 `.test.tsx` 里只要有文件再次与 include 规则错开，没有东西会报警。
- `shared/**` 的「纯同构」目前只是约定，没有静态门禁（不许 React / `ctx` / DOM / Node）。
- 面板 `host-shell.ts` 覆盖率仍偏低，是 85% 线的拖累项；补测试即可，与功能无关。
