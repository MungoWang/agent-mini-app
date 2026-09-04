# TODO

Platform runtime/SDK, react-host, and the dsh-host install gate are landed. See `docs/architecture/overview.md`, `LOCAL.md`.

---

## 小程序作者闭环：静态检查 + 运行时回流（2026-09-04 dsh 实测反馈）

> **状态**：P0-1 / P0-2 / P0-3 / P1-4 / P1-6 / P1-7 / P2-8 / **P2-9** 已落地并实测通过
> （`pnpm verify` 14/14 + 覆盖率门禁，真实 Chrome × 真实 host 跑通「crash → 卡片 → host → 工具」
> 与「tool → SSE → shell → iframe → 同源 POST → 工具」全链路）。
> P2-10 按决定推迟，P3 挂起。
> 实施中额外发现并修复 2 个原反馈未提到的 bug：
> ① 诊断脚本因模板占位符嵌在引号内而生成语法错误（`var APP_ID = ""com.x""`），
>    整段静默不执行 —— 已把「脚本必须能被解析」做成门禁（`new Function` + 求值 app id）；
> ② `esbuild minify` 把组件名压成 `e`/`Pye`，`componentStack` 失去定位价值 —— 改 `keepNames`。
> 同时补了 `host-shell.ts` 的测试（原 1% 覆盖，是把 panel 压到 85% 线下的原因）。

来源：agent 完整跑通「注册 → 编译 → 冒烟 → 上线 → 翻车 → 修复」后的实测反馈。结论：编写/后端验证闭环已经顺，短板集中在 **UI 侧的「检查—观察」回路**。

### 全局约束（每条都要遵守）

- **iframe 与 panel 跨源**：iframe src = `${hostOrigin}/app/…`，parent = 宿主页面 origin（dsh）。父页面**读不到** iframe DOM，`postMessage` 只能 iframe → parent 单向传，且需要指定 targetOrigin。所以运行时报错 / DOM 快照一律走 **iframe → 同源 host HTTP 上报 → host ring buffer → agent tool 读取**，不要让宿主去抓 iframe。
- **先注册工具再写文档**：`scripts/check/skill.mjs` 的 tool-catalog 规则要求文档里出现的每个 `mini_app_`* 必须已在 `packages/host/src/tools/tool-facade.ts`（或 `packages/dsh/src/lifecycle.ts`）注册，否则 `pnpm check:skill` fail；反之代码里有、文档没提是 warn。
- `packages/ui` **新增用户可见文案必须过** `useLabels` **+** `en.ts`**/**`zh.ts` **同批加键**（AGENTS.md 硬规则）。
- **动 host 运行时依赖时，dsh** `tsup.config.ts` **同步加 external**（约束 #10）。
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

- JIT 按**源码文本**扫描 → ``bg-${c}-500`` 拼出来的类名会**静默不生成 CSS 且不报错**。这才是唯一真坑，也是它退化成 inline style 的根因。类名必须完整字面量出现。
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

### ✅ P2-9 定稿并落地：`mini_app_dom_snapshot` → `mini_app_view_eval`

推送式快照已整体删除（含 `AppDomSnapshot` / `reportAppSnapshot` / `/snapshot` 两条路由 / `trimOutline` / 开屏 300-1200-3000ms 定时采集），换成「在渲染出的视图里执行 agent 自己写的 JS」的通用工具。
理由：任何我们预先设计的查询形态（选哪些节点、报哪些字段、默认视图长什么样）都是在**猜 agent 会问什么**，
猜不全就变成永无止境的 feature request；而它本来就会写 JS。

#### 判据（后续任何增删都按这两条裁）

1. **能力轴只有两个真问题**：谁拥有遍历（我们 / agent）、返回到什么尺寸（护栏）。
  其余一切——选点、投影、谓语——都是场景预设，**不进 API**。
2. **注入面只放两类东西**：(a) 必须由我们保证单一实现来源的；(b) 全行业通用、模型不看文档也用对的。
  我们自己的缩写一律不进。每多一个特殊名字，就多一份要常驻模型注意力的记忆负担。



#### 工具签名

```ts
mini_app_view_eval({ appId, code?, maxBytes? })   // maxBytes 硬顶 6144，min(…, 6144)
```

- `code` 是 **async 函数体**，不是表达式 —— **必须** `return`，否则结果 `undefined`
- 缺省 `code` = `mma.$("#root")`（返回一棵浅树，最便宜的起手式）
- 三种模式 / 枚举 / 预设：**没有**。`mode` 在讨论中先由 3 收到 2、再收到 0



#### 注入面（就这三个，别加第四个）

```
mma.$(sel, root?)     Element | null
mma.$$(sel, root?)    Array<Element>  ← 原生数组，不是 jQuery 对象
mma.selector(el)      可直接回填 mma.$() 的 CSS 选择器
```

- `mma.selector` 是唯一的 (a) 类：标准 JS 写得出 nth-chain，但**格式必须只有一个来源**，
否则 agent 自己写的和输出里的对不上，"拿地址粘回去继续查"这条主路径就断了
- `mma.$` / `mma.$$` 属 (b) 类（jQuery 先验），省的不只是字符，是 `querySelectorAll` 的拼写出错面
- 宿主侧数据不做包装：同源 `fetch('/api/app/'+APP_ID+'/errors')` 就能拿 —— **任何宿主侧能力都离一次
fetch 这么近，这是通用逃生口**，不需要逐个包成函数
- 不注入 `render`：护栏在执行层（见下），序列化默认就有，`render` 只剩"自选投影参数"，
而那张参数表正是我们要消灭的东西
- 不提供"展开到 N 层"旋钮：agent 自己写遍历（标准 JS、少数场景）。等 `truncated`/代码长度分布
显示人人都在手搓，再按证据加

**不做 hint 映射表**：`$$` 的返回类型写在 description 里一行即可；jQuery 误用会自然抛
`... is not a function`，那已经是可读的错误。

#### 护栏在执行层，不在 `render` 里

任何返回值（字符串 / 数字 / 对象 / Element / Element[]）都过同一个序列化器，四道硬闸**先到先停、无法关闭**：


| 闸                        | 为什么必须独立存在                                                |
| ------------------------ | -------------------------------------------------------- |
| 字节 `min(maxBytes, 6144)` | 边序列化边累计，不是事后 `slice`                                     |
| 节点计数                     | 字节要拼出来才知道，计数能**提前**刹车（`return mma.$$('*')` 该在拼第一个字符串前就停） |
| 递归深度                     | agent 返回自引用结构                                            |
| 墙钟超时                     | `view` 侧 1.5s                                            |


配套：cycle-safe（`parent`↔`children` 互指）；`return mma.$$(".x")` 与显式序列化走同一实现，
所以**忘了调用只会少个选项，不会绕过约束**。

拦不住的：**同步死循环**（`while(true)`）执行层拿不到控制权，唯一逃生口是重载 iframe。
这条必须写进 SKILL.md —— 不写等于承诺了我们做不到的事。

#### 输出契约：含义必须随输出传递

凡是需要图例才能读懂的字段，要么换成模型本来就认识的名字（`.class`、`display:none`、`color=` 都来自
CSS 语料，免费），要么**在结果头部声明一次**。不写进文档要求它背。

```
# 12 shown of 87 in subtree · depth 2 · coords: viewport px (scrolls with page) · viewport 1728x941 · 0.7KB
div.panel.flex.flex-col.gap-4  x=16 y=64 w=380 h=812  (4 children)
  div.panel-head  x=16 y=64 w=380 h=48  (2 children)
    h2.title  x=16 y=64 w=200 h=24  "面板"
    button.btn  x=320 y=70 w=76 h=32  "刷新"
  aside.notes  x=16 y=564 w=380 h=212  (6 children)  display:none
    +2 deeper levels not shown
```

- 容器只报 `(N children)`，**不拼** `textContent` —— 面板的文本是整页文字，是最大噪声源兼爆炸源
- 叶子才给引号文本
- `x= y= w= h=` 带标签（裸 `16,124 120x96` 会把 `16` 读成宽度）；"哪个坐标系"靠头部一行声明，
因为这是唯一无法靠命名自明的信息
- `[display:none]` / `[detached]` 保留：它们没有 rect，不标就会让 agent 去修一个不存在的布局 bug
- **截断必须可见**（`+N deeper` / `+N more` / `truncated` / `stoppedBy`）—— 静默截断会被读成完整
- 纯 2 空格缩进，不用 `├─`：制表符每行多花 1–2 token 而缩进已足够表达父子关系
- 返回值形态规则：单个 Element → 浅树（默认 depth 2）；数组 → 每行一个不带子节点

返回信封：

```
{ ok, view, tookMs, bytes, truncated, stoppedBy, visited, matched, dropped?, result }
```

`stoppedBy` 让 agent 知道被哪道闸拦的 —— 字节截断要收窄查询，节点截断要缩 `rootSelector`，是两种下一步。

错误只分四类，**必须可区分**，否则 agent 会去改一段没写错的 JS：
`syntax`（行号要减掉 preamble 偏移，并回显出错那行源码 + caret）· `runtime` · `timeout` ·
`view`（`not-open` / `runner-not-booted`，不是代码问题）。

#### 通道与安全

```
tool → host 查 viewEpoch → 在【宿主已有的】/api/events 上发查询 → shell postMessage 进目标 iframe
     → iframe 执行并同源 POST 回 → host 按 requestId 唤醒（默认 1.5s 超时）
```

- **iframe 自己不开第二条 SSE**：宿主页（dsh client / panel host-shell）本来就有 `/api/events`
- `view` 四态靠一个**存活标记** `viewEpoch(appId)`（一个时间戳）区分：没开 / runner 脚本没执行 / 页面卡住 / 活着。
这不是假想风险 —— 本轮就真踩过 runner 诊断脚本因模板占位符语法错误而**整段未执行**
- `postMessage` 三点必锁：`targetOrigin` 用 host origin（顺手把现有 `postEnv` 的 `"*"` 一起收紧）、
iframe 侧校验 `event.origin` + `event.source === window.parent`、`requestId` 由 host 签发 + 绑 appId + 一次性消费
- **宿主直读 iframe DOM 物理上做不到**（跨源）：采集代码必须活在 iframe 里，换触发方式也改变不了这点



#### 文档怎么喂（这条决定成本）


| 位置                            | 谁付 token              |
| ----------------------------- | --------------------- |
| SKILL.md 正文                   | 每个小程序任务都付，包括 99% 不用它的 |
| `references/eval.md` 按需       | 决定要用才付                |
| **工具 schema 的** `description` | **不调用零成本，调用时正好在眼前**   |


所以：schema description 装 6 行封顶（async 函数体必须 `return` · 返回类型不是 jQuery · 注入面三行 ·
缺省行为 · 死循环会冻页面）；`references/eval.md` 只装**判断类**内容（什么时候该用、标准 DOM 查法示例、
`view` 四态分别怎么办）；SKILL.md 只加 read-on-demand 一行。**文档里标准 API 优先、简写标注为 shorthand**，
否则 recipes 会变成我们的方言样本。

#### 明确不做（这一路逐条否掉的，别再走回头路）

1. ❌ **像素/截图**（html2canvas 之类）：能取到像素 ≠ 能评估"好不好看/有点歪"，判断仍是人和 AI 来回截图的事，性价比太低。
  真截图的名字 `ui_snapshot` 仍然留着不占用
2. ❌ **jQuery 兼容层**：实现著名 API 的部分子集比不实现更糟 —— 模型越熟越会**自信地调用我们没有的方法**，
  且 jQuery `.offset()` 是文档坐标（不含 scroll），拿它判"视口外"会静默得到错误结论
3. ❌ **谓语/筛选枚举**（`offscreen`、`zero-area`、`invisible-text`、`paint-invisible`…）：机械可判定 ≠ 无立场，
  "哪些条件值得内置"本身就是观点
4. ❌ **开屏自动采骨架当 selector 地图**：`ui.tsx` 是 agent 自己写的，它知道所有 class/id；
  唯一不知道的（库组件内部结构）拿一次 eval 就补上了
5. ❌ **给契约生成** `Renders:` **一行**：同上，一次 eval 就够，不值得建生成机制
6. ❌ `code` **传数组做多查询**：一个函数体 `return {a, b, c}` 就是同一能力且更好 —— 数组是 n 次遍历、
  串行 IO、按下标认不出结果、还要新发明部分失败协议
7. ❌ `mode` **分层 /** `summary` **独立层 / 缓存兜旧数据**：都在讨论中被否掉，缓存整个删掉（host 侧 DOM 常驻内存归零）



#### 移除范围（已按此执行）

- `packages/host/src/events/host-events.ts`：`AppDomSnapshot` / `appSnapshot` / `reportAppSnapshot` /
`APP_SNAPSHOT_BUFFER` / `APP_SNAPSHOT_BYTES`
- `packages/host/src/http/http-gateway.ts`：`GET|POST /api/app/:appId/snapshot` 两条路由；
新增 `POST /api/app/:appId/view/eval` 回传 + `POST /api/app/:appId/alive`（`viewEpoch`）
- `packages/host/src/tools/tool-facade.ts`：`mini_app_dom_snapshot` 定义 + `handleDomSnapshot` +
`trimOutline` / `OUTLINE_KEY_DOC`（采集后才裁是**假优化**：DOM 遍历和 payload 的钱已经花掉）
- `packages/host/src/http/app-runner-html.ts`：开屏 300/1200/3000ms 定时采集 + 全树 walk；
换成 message listener + 序列化器 + 护栏（**错误上报保持推送**：崩溃无法事后轮询，且它和 SSE 是不同传输）
- `packages/panel/src/*`、`packages/dsh/src/client/index.ts`：新增查询事件的转发（复用 `subscribeHostEvents`）
- skill：`SKILL.md` 工具表 + checklist 里的 `mini_app_dom_snapshot` 全部换成 `mini_app_view_eval`；
`troubleshoot.md` 对应行改写
- 相关测试同步删改

**先删后建放同一个 PR**：留着它意味着同时维护两条通道，而它的默认采集行为正是我们判定不该做的事。

#### 落地后要观察的指标（"基于结果做结构性优化"的证据来源）

`code` 长度分布 · `bytes`/`maxBytes` 占比 · `truncated`+`stoppedBy` 频率 · `view` 非 live 的比例 ·
超时率。没有这些记录，下一次就还是在猜。

### P2-9 落地记录（真实 Chrome × 真实 host，不是单测）

落点：`packages/host/src/http/app-view-eval.ts`（新）· `events/host-events.ts`（viewEpoch + pending + `app:eval`）· `http/http-gateway.ts`（`POST …/alive` + `POST …/view/eval`，删两条 snapshot）· `tools/tool-facade.ts` · `panel/src/frame.ts` + `rest.ts`（`relayViewEval`）+ `host-shell.ts` · `dsh/src/client/index.ts` · `docs/contracts/runtime-diagnostics.md` · skill `references/eval.md`（新）。

实测结果：默认 `#root` 查询 **1–4ms** 返回；`{label, sel, display, radius}` 投影里 `radius: "8px"` 直接证明 Tailwind 类落地；`return (;` → `kind:"syntax"`；`const a=1; return null.x;` → `kind:"runtime", line:2, source, caret`（真实浏览器里 V8 偏移正确）；`while(true)` → `view:"stuck"` @1501ms；shell 无 frame 时 `not-open` 立即返回（1–2ms），不烧 timeout。

**浏览器检查抓到 3 个单测原理上抓不到的 bug**（`.toString()` 注入这套写作的代价，必须记录）：

1. **`__name is not defined` 把整个 runtime 打死**。tsup/esbuild 的 `keepNames` 会在函数体**内部**追加 `__name(find,"find")`，而那个 helper 只存在于 bundle 的 module scope —— 字符串注入到 iframe 后 ReferenceError，脚本一行都没跑（25 处调用）。所有 `new Function(js)` 解析断言、所有 includes 断言全绿。**修法**：`viewEvalRuntime()` 把注入体包进一个块，块里先 `var __name = t => t;`；门禁加一条「运行时源码里出现的每个 `__xxx(` 都必须被 wrapper 自己声明」。这是原反馈里「诊断脚本因占位符语法错误整段未执行」的同类复发，换了个更隐蔽的触发点。
2. **`el.tagName === "SVG"` 永不成立**：SVG 元素的 `tagName` 是小写 `svg`，所以「不进图标内部」这条从来没生效过；顺带发现对象键下的 function 会把**整个函数源码**打出来（最容易撑爆字节预算的单一来源）。两处都已修，且都在 Chrome 里复核过（`svg … (3 children)` 不再下钻、`fn: [Function named]`）。
3. **我自己写的提示是假的**：`stuck` 的下一步原本写「`mini_app_open` 会重载 iframe」——错。`mount()` 按 P1-6 的决定**不重载已存在的 frame**，而且真 Chrome 下卡死的 iframe 会连**宿主页一起冻住**（CDP 对整个 tab 超时，连 close_page 都失败）。已改成实话：「没有任何工具能救，请让用户刷新浏览器标签页」。写进 SKILL/contract/troubleshoot 的同一批位置。

**顺带修掉一个真实缺口**：`createHostShell` 从来没订阅 `app:open`，所以在参考宿主 react-host 上 `mini_app_open` 只把面板打开到列表页、**不挂 iframe**，后续 `mini_app_errors` / `mini_app_view_eval` 全都在等一个不存在的 view（dsh client 早就在自己的 handler 里做了）。现已在 shell 里接上，dsh 保持单条 SSE 不动。同时 `postEnv` 的 `targetOrigin` 从 `"*"` 收紧成 host origin。

**按判据没做的事**：没有 `render` / `mode` / 层级旋钮 / selector 地图 / hint 映射表 / 结果缓存；像素截图仍然不做；`ui_snapshot` 这个名字继续留着不占。

**指标还没落地**：本节末尾要求的 `code` 长度分布 / `bytes`÷`maxBytes` / `truncated`+`stoppedBy` 频率 / `view` 非 live 比例 / 超时率 —— 单次数据都在信封里，但 host 侧**没有聚合记录**。下一轮结构性优化之前得先有这个东西，否则还是在猜。

### ⏸ P2-10 首次种子数据 —— **推迟**

用户决定后面再考虑，暂不动 `defineApp` 契约。当前维持反馈里那个「靠冒烟调用手动塞 demo」的巧合行为，不写进文档当惯例。

### ⏸ P3 挂起：jsdom 渲染探针

`packages/ui-examples/tests/render.test.ts` 的先例（注释原话：tsc 和 host 编译都放行，错误只在浏览器暴露，所以挂载一遍而不是信类型检查）说明方向正确，但成本现在不划算：编译产物 import `/mma/runtime.js`、`/mma/sdk.js` 绝对路径要在 Node 侧重定向；jsdom 进 host 运行时依赖会拖重 dsh bundle 且必须 external。P0-1 + P0-2 已覆盖本次实际 bug。等错误回流上线后按真实数据再决定。

### 实测记录（真实 Chrome + 真实 host）


| 验证项                                    | 结果                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P0-2 拦住 `greet()` 定义 / `greeting()` 调用 | `reload` → `ui: "greeting()" is called but never defined or imported — ui.tsx:3:43`，且 `committed.status: skipped` |
| P0-1 编译通过但 render 期崩溃（`null.map`）      | 浏览器显示卡片（中文，跟随 host locale），host 收到 `kind: "render"` + `componentStack: at Ui (…)`                                 |
| P2-9 `w-[137px] h-[41px] bg-rose-500`  | 快照实测 `137x41` + `bg: oklch(0.645 0.246 16.439)` —— 任意值类与调色板类都有可验证证据                                               |
| P1-7 二次 reload 无改动                     | `committed.status: "clean"`（正是原反馈遇到的歧义场景）                                                                         |
| P2-8 批量 CRUD                           | 一次往返 3 个方法，中途抛错不阻断其余，`failed: 1`                                                                                  |
| `mini_app_open` 回执                     | 无浏览器连接时如实返回 `panel: "no-panel-connected"`                                                                         |


**结论修正**：原反馈里「Tailwind 有 safelist 限制」是误判 —— 真 JIT 一直可用；缺的只是说明。

### 明确不做

1. `ui_snapshot` 像素截图 —— 见 P2-9。
2. 手写 theme 文档 —— 走生成（P1-4）。
3. Tailwind 改预编译 safelist —— 现在的真 JIT 是对的，问题只在没写文档，加 safelist 是给不存在的 bug 打补丁。
4. reload 开全量 strict 类型检查 —— 噪音淹没信号（P0-2）。



## Authoring protocol unification - 老任务已落地

硬切完成：两侧统一 `@monkey-mini-app/ui`（backend 注入 `defineApp`）、`ui/` `api/` `shared/` 互斥 + app 根边界、旧名（`@monkeyagent/*` / `defineDashboard` / `useDashboardApi`）删除。见 `[docs/rfcs/authoring-protocol.md](docs/rfcs/authoring-protocol.md)`。

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

**Skill ↔ code 同步**：契约见 `[docs/contracts/skill-sync.md](docs/contracts/skill-sync.md)`（生成器 + `pnpm check:skill` 门禁）。待平台侧决定：`mini_app_unregister`（整 app 删除工具）；`packages/ui/src/index.ts` 未 re-export `lib/illustrations`（只靠 `build-ui.mjs` 注入 dist）；`manifest.permissions` 被 parse 但不校验。

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

