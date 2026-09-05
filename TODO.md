# TODO

只列**当前在做**或**已决定要做但还没开工**的事。做完就搬去 `docs/archive/tasks/<short-desc>-<date>.md`（规则见 `AGENTS.md` → Doc rules）。

---

## 在做

无。`mini_app_install` + 第 8 个模板 `spreadsheet/` 已落地（归档见 `docs/archive/tasks/per-app-packages-2026-09-05.md`）。

## 已排期，等触发条件（判据都在 RFC 里，别凭手感启动）

| 事项 | 开工条件 | 依据 |
|---|---|---|
| motion 动画库 | 真出现「keyframes 打架」的实际案例；现在只靠 skill 劝 | `docs/rfcs/authoring-surface.md` §8 步骤 3 |
| 4 个 layout presets | 槽位 API 得先被一个真实模板用过，否则是凭空设计 | 同上 §8 步骤 4 |
| templates / paradigms 重做 | 必须排在 motion + presets 之后，不然重写两遍 | 同上 §8 步骤 5 |
| `mini_app_view_eval` 观测指标 | 第二次出现「不知道该不该改形态」的争论，或 `view` 非 live > 5% | `docs/rfcs/view-eval-metrics.md` |
| 额外包的 approve/reject 弹窗 | **只在出现分享/安装别人的包时**，而且打在包上，不给本机自用的 app 加围栏 | `docs/rfcs/per-app-packages.md` §7 |
| backend worker / 子进程隔离 | 某个 app 的 native 依赖真的把宿主拖崩过一次 | 同上 §4 |

## 挂起（低优先，随时可捡）

- `shared/**` 的「纯同构」目前只是约定，没有静态门禁（不许 React / `ctx` / DOM / Node）。
- 面板 `host-shell.ts` 覆盖率仍偏低，是 85% 线的拖累项；补测试即可，与功能无关。
