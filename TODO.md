# TODO

Platform runtime/SDK, react-host, and the dsh-host install gate are landed. See `docs/architecture/overview.md`, `LOCAL.md`.

---

## 小程序作者闭环：静态检查 + 运行时回流（2026-09-04 dsh 实测反馈）

> **状态：P0/P1/P2 已全部落地并实测通过**（`pnpm verify` 14/14，真实 Chrome 跑通
> 「crash → 卡片 → host → 工具」全链路）。P2-10 按决定推迟，P3 挂起。
> 实施中额外发现并修复 2 个原反馈未提到的 bug：
> ① 诊断脚本因模板占位符嵌在引号内而生成语法错误（`var APP_ID = ""com.x""`），
>    整段静默不执行 —— 已把「脚本必须能被解析」做成门禁（`new Function` + 求值 app id）；
> ② `esbuild minify` 把组件名压成 `e`/`Pye`，`componentStack` 失去定位价值 —— 改 `keepNames`。
> 同时补了 `host-shell.ts` 的测试（原 1% 覆盖，是把 panel 压到 85% 线下的原因）。



来源：agent 完整跑通「注册 → 编译 → 冒烟 → 上线 → 翻车 → 修复」后的实测反馈。结论：编写/后端验证闭环已经顺，短板集中在 **UI 侧的「检查—观察」回路**。

### 全局约束（每条都要遵守）

- **iframe 与 panel 跨源**：iframe src = `${hostOrigin}/app/…`，parent = 宿主页面 origin（dsh）。父页面**读不到** iframe DOM，`postMessage` 只能 iframe → parent 单向传，且需要指定 targetOrigin。所以运行时报错 / DOM 快照一律走 **iframe → 同源 host HTTP 上报 → host ring buffer → agent tool 读取**，不要让宿主去抓 iframe。
- **先注册工具再写文档**：`scripts/check/skill.mjs` 的 tool-catalog 规则要求文档里出现的每个 `mini_app_*` 必须已在 `packages/host/src/tools/tool-facade.ts`（或 `packages/dsh/src/lifecycle.ts`）注册，否则 `pnpm check:skill` fail；反之代码里有、文档没提是 warn。
- **`packages/ui` 新增用户可见文案必须过 `useLabels` + `en.ts`/`zh.ts` 同批加键**（AGENTS.md 硬规则）。
- **动 host 运行时依赖时，dsh `tsup.config.ts` 同步加 external**（约束 #10）。
- 工具返回结构变化 = 契约变化：`docs/contracts/` + skill `SKILL.md`/`references/troubleshoot.md` 同一批改完。

### ✅ P0-1 运行时错误回流（`mini_app_errors`）— 已落地

现状：`app-runner-html.ts` 的 try/catch 只包住 `await import(entry.js)`（模块求值期）；React render/effect 期错误无 `ErrorBoundary`（全仓 grep `ErrorBoundary|componentDidCatch|unhandledrejection` 零命中），而 wrapper 在 mount 前已清掉 `#root.boot` → **结果是一块纯白 iframe，一个字都没有**。人看不到，agent 更看不到。这是本轮最痛的点，且比反馈本身描述的更严重。

改动：

1. `packages/ui`：新增 `AppErrorBoundary`（`src/sdk/` 或 `src/lib/`），从 `src/index.ts` re-export。渲染态错误 → 显示错误卡片（**不再白屏**）+ 带 appId / 层（render）/ 组件栈。卡片文案走 `useLabels`，`en.ts` + `zh.ts` 同批加键。
2. `packages/host/src/compile/ui-compiler.ts` wrapper：用 `AppErrorBoundary` 包住 `<Ui />`（在 `UiProvider` 内层，保证卡片还能拿 i18n）。
3. `app-runner-html.ts`：加 `window.addEventListener("error")` + `"unhandledrejection"`；同时把现有那段裸 `e.stack` 的 `.err` 渲染改成结构化卡片 —— 模块加载失败要写清 **哪个 app、哪一层（module/load）、下一步做什么**，而不是一坨 stack 文本（这是「报错信息不友好」的落点）。
4. 三条通道（boundary / module-load / uncaught）统一 `POST /api/app/:appId/errors`，body 结构化 `{ kind, message, file, line, column, stack?, componentStack? }`。上报失败必须静默（不能让诊断通道把 app 再弄崩一次）。
5. `packages/host/src/events/host-events.ts`：加 per-app 错误 ring buffer，复用 `APP_EVENT_BUFFER` / `replay` / `gap` 的现成模式，但**独立 channel**——诊断不能和 `ctx.push` 作者事件混在一起。`reload` / `forget` 时清空。
6. `http-gateway.ts`：`POST /api/app/:appId/errors`（收）、`GET /api/app/:appId/errors?since=`（读，供人/debug）。
7. `tool-facade.ts`：注册 `mini_app_errors({ appId, since?, clear? })` → `{ ok, errors: [{ at, kind, message, file, line, componentStack? }], truncated }`。
8. skill：`SKILL.md` 工具表 + 新「调试回路」段落（reload → open → 等一次渲染 → `mini_app_errors`）+ checklist 加一项；`troubleshoot.md` 补「白屏 / 面板无变化」两行。

验收：故意写一个 render 期未定义标识符的 app → `mini_app_errors` 能拿到 message + componentStack，iframe 显示卡片而非白屏。

### ✅ P0-2 reload 静态检查（未定义标识符）— 已落地

现状：`reload()` = `parseManifest` + `compileAppSource`(sucrase，纯剥类型) + `loadMainApi` + `uiCompiler.compile`。esbuild 不做类型检查，且**未知标识符直接当全局变量输出**，所以 `greeting()` 这类「定义与调用名字对不上」畅通无阻——正是本次唯一的 bug。同类洞 `TODO.md` 早就记着（backend 命名导出类型放行、运行时 undefined），属第二次独立命中，不再等阶段 2。

方案（**不用**全量 `tsc` program）：

- 用 TS 的 parser-only API：`ts.createSourceFile` + 走作用域收集 binding 与 reference，报「引用了但从未声明、且不在 globals 白名单内」的标识符。仓内已有先例：`scripts/check/skill.mjs` 就是这么用 `ts.createSourceFile` 的（`typeLiteralKeys`）。
- 为什么不开 checker：`lib.*.d.ts` 加载 + 全量类型噪音会把真正的信号（名字拼错）淹没在几十个无关类型报错里。这一层唯一目标是 **TS2304 等价信号**。
- did-you-mean：对已声明标识符做 Levenshtein，命中就出 `undefined identifier "greeting" (did you mean "greet"?)`。TS2552 那种提示对 agent 价值最高。
- 分层：`errors[]` 只放确定错（未定义标识符）；可疑但合法的（未在白名单的浏览器新 API 之类）放独立 `notices[]`，**只提示不阻塞**，避免白名单不全时误伤导致 reload 全红。globals 白名单单独成文件 + 单测覆盖常见 DOM/ES API。
- UI 与 backend 都跑（`main.api.ts` 方法体内的未定义 helper 同样抓）。
- 缓存复用 `ui-compiler.ts` 的 `cacheSig`（mtime+count）模式。
- ⚠️ `typescript` 现在是 host 的 **devDependency**，要提到 `dependencies`，并在 dsh `tsup.config.ts` 加 external（约束 #10）。若判断安装态成本过高，退路是走 esbuild AST 的替代 parser，但优先 TS parser——本仓已在用它。

落点：`packages/host/src/compile/`（新文件，如 `static-check.ts`）+ `apps-manager.ts:reload()` 接进 `errors[]`（带 `ui:` / `main.api:` 前缀，沿用现有分层前缀约定）。

验收：`greeting()` 场景在 reload 就被拦住，且报错带 did-you-mean。

### ✅ P0-3 Tailwind 能力边界 → `references/styling.md` — 已落地

反馈里这条是**误判**：平台早做对了，缺的只是一句话。`compile/app-css.ts` 是真 JIT（`@import "tailwindcss" source(none)` + `@source` 扫 app 自身全部源码），不是预编译 safelist。已验证 `packages/ui/dist/globals.css` 含 `--color-rose-500`，且 runner 注释明确了 app sheet 与 `/ui.css` 的 layer 覆盖顺序。所以 `hover:bg-muted` / `group-hover:opacity-100` / `bg-rose-500` / `w-[437px]` 全部可用。

新页 `skills/monkey-mini-app/references/styling.md`（或并入现有参考），必须写清：

- JIT 按**源码文本**扫描 → `` `bg-${c}-500` `` 拼出来的类名会**静默不生成 CSS 且不报错**。这才是唯一真坑，也是它退化成 inline style 的根因。类名必须完整字面量出现。
- 默认调色板 / 任意值 / 全部变体可用 —— 明确「**不要**因为拿不准就退回 inline style」。
- `.autogen/` 是生成产物，手改下次 compile 被覆盖。
- SKILL.md 的 read-on-demand 表 + UI 段落各加一行指路。

### ✅ P1-4 theme token 表（生成，禁止手写）— 已落地

`globals.css` 有 293 个 CSS 变量，agent 目前靠逆推模板猜 token。手写一页表必然漂移，而过期表比没表更坏。做法：从 `globals.css` 抽 var 名 + `@theme inline` 映射，生成 `skills/monkey-mini-app/references/theme.md`，接进 `scripts/gen/skill/index.mjs`；`check:skill` 加规则校验表里的 var 名确实存在于 `globals.css`。

### 🟡 P1-5 动画 — 按决定只留占位（等 motion）

已确认 `globals.css` 引了 `tw-animate-css`（提供 `animate-in` / `animate-out` / `fade-in` / `slide-in-from-*` / `zoom-in`）。反馈里的 `pt-in` **全仓不存在**，是 agent 幻觉出的类名 → 静默无效果 → 它转去注入 `<style>` keyframes → 撞上 `fill: both` 与 inline opacity 打架。缺口确实存在，但用户考虑引入内置动画库 `motion`，所以：**动画这块先不多写**。只补一句「勿自行注入 keyframes」，并在本条记录 motion 待定；正式动画指引等 `motion` 落地后单独出。

### ✅ P1-6 reload 不刷新已打开的 iframe（真 bug）— 已修

两个断点叠加：(a) `HostEvent` 只有 `app:open` / `app:event`，reload 完全不通知前端；(b) `packages/panel/src/frame.ts:mount()` 对已存在的 rec 只改 `display`，不重设 `iframe.src` —— 只有首次创建才赋 src。结果 `mini_app_edit` → `reload` → `open` 时若 app 之前开着，**面板仍是老代码**，除非用户手点工具栏刷新。

这是反馈「刷新语义靠嘴说」的真实根因（不是缺回执，是真的不刷）。改：`HostEvent` 加 `app:reload`，`reload()` 成功后 emit；panel/dsh 侧订阅并对已挂载的 frame 走 `frame.reload(appId)`。

### ✅ P1-7 `committed` 四态（原来 `null` 混表三种意思）— 已落地

`apps-manager.ts:reload()` 里 `committed: null` 同时表示：编译失败没走到 commit / 编译通过但 worktree 干净（edit 已 auto-commit，反馈遇到的就是这个）/ commit 自身失败。不该让 agent 猜。改成显式判别，如 `committed: { status: "committed" | "clean" | "failed", commitId?, reason? }`，同步 `SKILL.md` 的 reload 返回表和 `troubleshoot.md`。

### ✅ P2-8 `mini_app_call` 批量（`calls: []`）— 已落地

现在 schema 单 `method` + 单 `args`，测一套 CRUD 要五个来回。加 `calls: [{ method, args }]`，逐项返回结果（一项失败不中断其余），保留单 `method` 向后兼容。

### 🟡 P2-9 `mini_app_dom_snapshot` — 功能已落地可用，但**取数形态未定稿，见下方「待决」**

命名先定 `mini_app_dom_snapshot`，把 `ui_snapshot` 让出来给以后的真截图。

明确不做截图：平台是 Hono server + iframe，无任何 headless browser 依赖，dsh 侧也是纯前端插件；为这个功能引 puppeteer/playwright 与「不往 host 漏 dsh、重依赖 external」的方向相反。DOM 摘要能命中真实痛点（不知道 hover / 主题类 / 对比度到底生效没有），像素解决的是另一个没被提出的需求。且受 P0-1 的跨源结论约束，采集必须发生在 iframe 内部。

做法：iframe 侧自采裁剪后的 DOM 大纲（tag / role / 文本摘要 / 实际生效的 color·bg·font-size / 是否 `initial` / 文本-背景对比度），`POST /api/app/:appId/snapshot` 存最近一份；`mini_app_dom_snapshot({ appId })` 读。

### 🔎 待决：DOM 快照的取数形态（2026-09-04 讨论结论，**未实现**）

当前落地的是**推送式**：iframe 在开屏后 300/1200/3000ms 各采一次全量 outline，host 每 app 存 3 份，
工具只能整份读回。功能可用（已实测），但有三处公认缺陷：

1. **无条件采集** —— 每个 app 每次开屏都遍历全树，即使没有任何 agent 会读；采集器每节点调
   `getComputedStyle` 会强制样式解析，而挂载后正是页面最忙的时刻。
2. **不能框 scope** —— 只能拿完整树，复杂 app 一次几百节点全进 context。
3. **缓存占内存** —— 每 app 3 份完整 outline（60KB×3），且超时回落读到的是**上一次别的 selector** 的结果，反而误导。

讨论已经排除掉的方向（不要再走回头路）：

- ❌ **iframe 自己开第二条 SSE 收查询指令** —— 宿主页（dsh client / panel host-shell）**本来就有**一条
  `/api/events`，应该复用它：host 在已有流上发查询 → shell `postMessage` 进 iframe → iframe 采集 →
  同源 POST 回 host。iframe 侧新增连接数为 **0**。
- ❌ **开屏自动采一份 depth 2 骨架给 agent 当 selector 地图** —— 站不住：`ui.tsx` 是 agent 自己写的，
  它知道所有 class/id；真正不知道的只有「库组件 render 出的内部结构」，而那个缺口**拿一次 snapshot 就补上了**，
  不值得为它在默认路径上放一次强制样式解析。（顺带否掉：给契约生成 `Renders:` 一行，同样没必要。）
- ❌ **由宿主直接读 iframe DOM** —— 跨源，物理上做不到；采集器必须活在 iframe 里，换触发方式也改变不了这点。

倾向方案（等用户拍板）：**纯 pull** —— 默认 `{appId}` 从 `#root` 起 depth 2 不带样式（几百字节轮廓），
`selector`/`depth`/`styles` 逐级加深；缓存整个删掉（host 侧 DOM 常驻内存归零），超时不兜旧数据。
配套要留一个**存活标记** `viewEpoch(appId)`（一个时间戳而已），否则「采不到」分不清是
没开 / runner 脚本没执行 / 页面卡住 —— 这三者必须是三种不同的返回值，不能都叫 timeout。
（这不是假设风险：本轮就真踩过 runner 诊断脚本因模板占位符语法错误而整段未执行。）

`postMessage` 落地时必须锁三点：`targetOrigin` 用 host origin（顺手把现有 `postEnv` 的 `"*"` 一起收紧）、
iframe 侧校验 `event.origin` + `event.source === window.parent`、`requestId` 由 host 签发并绑定 appId 一次性消费。

### ⏸ P2-10 首次种子数据 —— **推迟**

用户决定后面再考虑，暂不动 `defineApp` 契约。当前维持反馈里那个「靠冒烟调用手动塞 demo」的巧合行为，不写进文档当惯例。

### ⏸ P3 挂起：jsdom 渲染探针

`packages/ui-examples/tests/render.test.ts` 的先例（注释原话：tsc 和 host 编译都放行，错误只在浏览器暴露，所以挂载一遍而不是信类型检查）说明方向正确，但成本现在不划算：编译产物 import `/mma/runtime.js`、`/mma/sdk.js` 绝对路径要在 Node 侧重定向；jsdom 进 host 运行时依赖会拖重 dsh bundle 且必须 external。P0-1 + P0-2 已覆盖本次实际 bug。等错误回流上线后按真实数据再决定。

### 实测记录（真实 Chrome + 真实 host）

| 验证项 | 结果 |
|---|---|
| P0-2 拦住 `greet()` 定义 / `greeting()` 调用 | `reload` → `ui: "greeting()" is called but never defined or imported — ui.tsx:3:43`，且 `committed.status: skipped` |
| P0-1 编译通过但 render 期崩溃（`null.map`）| 浏览器显示卡片（中文，跟随 host locale），host 收到 `kind: "render"` + `componentStack: at Ui (…)` |
| P2-9 `w-[137px] h-[41px] bg-rose-500` | 快照实测 `137x41` + `bg: oklch(0.645 0.246 16.439)` —— 任意值类与调色板类都有可验证证据 |
| P1-7 二次 reload 无改动 | `committed.status: "clean"`（正是原反馈遇到的歧义场景） |
| P2-8 批量 CRUD | 一次往返 3 个方法，中途抛错不阻断其余，`failed: 1` |
| `mini_app_open` 回执 | 无浏览器连接时如实返回 `panel: "no-panel-connected"` |

**结论修正**：原反馈里「Tailwind 有 safelist 限制」是误判 —— 真 JIT 一直可用；缺的只是说明。

### 明确不做

1. `ui_snapshot` 像素截图 —— 见 P2-9。
2. 手写 theme 文档 —— 走生成（P1-4）。
3. Tailwind 改预编译 safelist —— 现在的真 JIT 是对的，问题只在没写文档，加 safelist 是给不存在的 bug 打补丁。
4. reload 开全量 strict 类型检查 —— 噪音淹没信号（P0-2）。


## Authoring protocol unification

硬切完成：两侧统一 `@monkey-mini-app/ui`（backend 注入 `defineApp`）、`ui/` `api/` `shared/` 互斥 + app 根边界、旧名（`@monkeyagent/*` / `defineDashboard` / `useDashboardApi`）删除。见 [`docs/rfcs/authoring-protocol.md`](docs/rfcs/authoring-protocol.md)。

**阶段 2（约定未开工，另开干净 PR）— S2 包面拆分：**
- 前端作者面 → `@monkey-mini-app/ui`（合并今天的 sdk：`useApp` + kit + iframe bundle）
- 后端作者面 → 新包 `@monkey-mini-app/api`（只 `defineApp` + 类型；运行时 host 注入或 esbuild 打包）
- 然后后端执行层改为 esbuild 打包（删 require 沙箱）→ 命名导出编译期失败，类型洞彻底堵上
- 动机：今天 backend `import { Button } from "@monkey-mini-app/ui"` 类型放行、运行时 `undefined`（已验证）

遗留（不阻塞）：

- 本地旧 import 小程序需按 skill 改（`mma-runtime/` gitignore）
- `shared/**` 纯同构无静态门禁
- panel 内部 `closeDashboard` 命名未改
- panel `host-shell.ts` 覆盖率拖低 threshold（与本协议无关的 WIP）

---

**Skill ↔ code 同步**：契约见 [`docs/contracts/skill-sync.md`](docs/contracts/skill-sync.md)（生成器 + `pnpm check:skill` 门禁）。待平台侧决定：`mini_app_unregister`（整 app 删除工具）；`packages/ui/src/index.ts` 未 re-export `lib/illustrations`（只靠 `build-ui.mjs` 注入 dist）；`manifest.permissions` 被 parse 但不校验。

Publish with `pnpm publish:packages` (runs `pnpm test:dsh` first; emergency `--skip-e2e`).


## ui-examples package (Phase 1 landed)

`packages/ui-examples` — portable examples (react + bare `@monkey-mini-app/ui` + relatives),
enforced by eslint `no-restricted-imports`; typechecked in `pnpm verify`. Component link is
the `@exampleOf` JSDoc tag, not the folder name.

Phase 2 (not started):
- decompose `areas/*.tsx` showcases into `components/<Name>/<name>-NN.tsx`
- Icon-ize `apps/demo-host/.../paradigms` and move them in (drops lucide)
- `gen/skill`: copy examples into `references/examples/`, link from `contracts/<slug>.md`
  (inline if small, else link — respect the 8KB contract cap), build `examples/<group>.md`
  for `@group` files; validate `@exampleOf` resolves in `check:skill`
- `gen/examples`: byte-copy selected files into `com.example.kit/lib/` for dsh e2e
