# monkey-mini-app

[English](README.md) | 中文

面向 AI 的小程序平台。三句话讲清楚：

1. 你说要什么，AI 把 app 写出来——你不用装框架、不用配构建、不用开编辑器。
2. app 不留在对话里。它脱离聊天界面，独立跑在你这台机器上：关掉会话还在，明天从
   画廊点开照用，每个版本都存在这个 app 自己的版本历史里——改错了？误删了？一句
   话就帮你找回。
3. 攒下来的是一个独属你的小程序库：信息雷达、今日台子、阶段看板、
   表格对比、每日打卡，还有每周五那点杂事的按钮。

而这些 app 反过来还能调用 AI：聊天在用的同一个模型、你已经接好的 MCP 工具、这台机器的
shell。

![AI 热点雷达](docs/assets/complex-demo-app.png)

*AI 热点雷达：一个开在聊天旁边的独立 app，不是聊天内容的一部分。源是可配置的，简报由
`ctx.llm` 写，它左边两个标签页是另外两个 app。*

## 能做什么

这些你都不用写代码。你描述诉求，agent 搭出 app、打开它、把自己造成的报错读回来，
改到屏幕上是你要的样子为止。下面这些只要有宿主就能用，不用先接任何东西；你自己的
系统接上来，同样的做法也能覆盖。

| 你说一句 | 你得到 |
|---|---|
| 「做个信息雷达，源我贴给你。按我在意的程度排，打开先看到一段简报」 | 源在 app 里就能改的雷达，主题评分，简报是写出来的，收藏存自己机器上。只用到 `ctx.http` 和 `ctx.llm`，不用贴 key |
| 「今天的事散在群、邮件和三个表里。放到一个屏，告诉我先干哪个」 | 一张工作台，把这几处拉成一条有序清单，存在这台机器上 |
| 「这个表格丢给你，哪里变了、哪里不对劲？」 | 拖拽上传，真的解析库只装进这个 app，一句话说清业务口径，每份都留着下次好对比 |
| 「订单、申请、稿件都按阶段追，老忘哪个卡住了」 | 按你自己的阶段排看板，每条带备注和历史，一列「在等谁」把没人动的挑出来 |
| 「每天记一行：花钱、锻炼、睡眠。然后给我看这一周」 | 本地日志、连续天数、趋势图，再加一周的书面回顾 |
| 「每周五那点杂事给我一个按钮：整理下载、出发票 PDF、备份文件夹」 | 它用 `ctx.bash` 在这台机器上跑，结果回到 app 里，而不是丢个终端给你 |

把你自己的工具接上之后，同一套做法就落到它们身上：按你的 JQL 排的 Jira 看板、把内网
API 做成一个表单、CI 跑挂了看哪一步、工时自动起草并写回。

创作 skill 里带了起步门面，所以上面这些都不是从空目录开始：今日台子、阶段看板、
信息雷达、表格台、执行器、一键杂事、值班屏、骨架示例。见
[`skills/monkey-mini-app/templates/`](skills/monkey-mini-app/templates/)。

## 一个 app 是怎么被做出来的

agent 靠宿主注册的 19 个 `mini_app_*` 工具驱动：

1. `mini_app_write` — `manifest.json`、`ui.tsx`、`main.api.ts` 落到 `runtime/apps/<id>/`
2. `mini_app_open` — app 出现在画廊里，同时在你对话旁边开一个标签页
3. `mini_app_errors` + `mini_app_view_eval` — 崩了？它去查实况 DOM、把栈读回来，而不是照着一张截图猜
4. `mini_app_reload` — 热重载，边聊边改
5. `mini_app_history_*` — 每个版本都是这个 app 自己 git 分支上的一次提交，所以「回到加图表之前」是一个调用

真的要第三方库（表格格式、消息队列客户端、厂商 SDK）用 `mini_app_install` 装，只进
**这个 app** 的 `node_modules`，并且记进它的历史。不碰你的全局依赖。

## 为什么不是一份生成的 HTML

Agent 早就能写出漂亮的 HTML，也能顺手起一个连数据库的 Flask。那些是一次性产物：HTML
关标签就没了，Python 站从此归你养。区别不在标记语言，在 app 站在这条缝的哪一侧。

| | 对话里的 HTML | Agent 起的本地网站 | 小程序 |
|---|---|---|---|
| 下周还在吗 | 关标签就没了 | 进程、venv、端口都归你盯 | 画廊里的一个 app，落盘，带 git 历史 |
| Agent 修正在跑的 UI | 来回截图 | 重启碰运气 | 报错和实况 DOM 是它能直接调的工具 |
| 按钮调用你的模型 | 自己贴 key | 自己接 provider | `ctx.llm`，和聊天同一个模型 |
| 按钮跑一轮 agent | 不能 | 自己搓 tool loop | `ctx.agent`，一次性，进度流进 app |
| 你已经接好的 MCP / 工具 | 不能 | 每个 app 重新鉴权 | `ctx.tool` / `ctx.mcp`，现成的 |
| 不套栈的 UI | 随机 Tailwind | 随机 CSS | 和宿主同一套组件与 theme token |

半年后想改也一样：点一下那个 app，说哪里不对，报错、实况 DOM 和这个 app 的历史都是它能
直接拿到的东西。

## App 继承了什么

`main.api.ts` 从宿主拿到一个 `ctx`。这些是宿主真实的能力，以你的身份运行：

```ts
ctx.llm(prompt, { schema, system, signal })   // 聊天在用的那个模型，返回 string
ctx.agent(goal, { streamTo, maxIterations })  // 一次性 agent 回合，事件流进你的 UI
ctx.tool(name, args)                          // 你已经接好的宿主工具
ctx.mcp(name, args)                           // MCP server 的工具
ctx.listTools()                               // 现在有什么可用
ctx.http(url, opts)                           // → { ok, status, headers, text, json }
ctx.bash(cmd)                                 // → { stdout, stderr, exitCode }
ctx.storage                                   // 重载还在的 JSON
ctx.push(event, payload)                      // 后端 → 这个 app 所有开着的视图
ctx.signal                                    // 点停止真的会停
```

`ctx.agent` 改变了按钮的含义。按钮不必是「再问模型一个问题」，可以是「去把这事查清楚，
需要什么工具自己拿，完了告诉我」——每一步都在 app 里实时出现。

## 另一半是组件套件

没有共享组件，agent 每个 app 自造一套栈，什么都和宿主对不上。`@monkey-mini-app/ui`
就是它写代码时对着的东西：100 多个组件，全部走 theme token，文案中英双份。

看板和时间线：`Kanban`、`KanbanIssuePanel`、`Gantt`、`EventCalendar`、`Timeline`、
`Stepper`、`CommitGraph`。数据：可排序可筛选的 `DataGrid`、`EnvTable`、`JsonViewer`、
`LogViewer`、`TreeView`、`AttachmentGallery`。编辑：`CodeEditor`、`RichTextEditor`、
`MarkdownEditor`、`DiffViewer`。图表：`StackedBarChart`、`DonutChart`、`RadarChart`、
`Gauge`、`Sparkline`、`ProgressRing`，以及包在 Recharts 外面的 `ChartContainer`。
还有决定一个 app 好不好用的那半边：
`FilterBar`、`PageHeader`、`DetailPanel`、`StatCard`、`CommentThread`、
`NotificationCenter`、`Terminal`、`AppShell`、日期时间选择器、Jira wiki 和 JQL 输入框。

重编辑器和语法高亮按需从 CDN 加载，所以从不打开代码编辑器的 app 不会带上 CodeMirror。

![UI 套件](docs/assets/ui-kit-demo-all-light.png)

## 一个小程序就三个文件

```tsx
// ui.tsx
import { Button, useApp } from "@monkey-mini-app/ui";

export default function Ui() {
  const { call } = useApp();
  return <Button onClick={() => call("ping")}>ping</Button>;
}
```

```ts
// main.api.ts
import { defineApp } from "@monkey-mini-app/api";

export default defineApp({
  name: "Ping",
  description: "one-line app",
  api: { ping: async (ctx) => ctx.appId },
});
```

UI 引 `@monkey-mini-app/ui` 和 `react`；后端引 `@monkey-mini-app/api`。辅助代码放
`ui/`（仅 UI）、`api/`（仅后端）、`shared/`（同构纯净，两边都行）。相对路径不能跳出
app 目录。

## 试用

运行依赖只有 Node 20+。没有 Docker、没有 Python、没有数据库，也不用先起一个前端工程：
`host`、`api` 和 dsh adapter 都声明 `engines.node: ">=20"`，而 dsh 本身就是个 Node CLI——
它跑得起来，平台就跑得起来，你不用再多装一套运行时。只有 `mini_app_install` 需要 `npm`
在 PATH 上，作用是把一个真的库装进那一个 app 自己的 `node_modules`。`pnpm` 只在从源码
跑的时候用得到。

接到 dsh web（当前已发布的 adapter）：

```bash
dsh plugin --profile web add @monkey-mini-app/dsh-mini-app
dsh web --no-open        # :3080 · apps host :17880
```

重启，点开侧栏的 **小程序**。

来一个快速的例子试试效果？对话框里输入：
```
给我做一个「AI 风向雷达」小程序，追近期 AI 动态：

1. 数据源用公开、权威的那些（各家官方 blog / 论文榜 / 权威科技媒体），拉回来让模型按
   「和我相关度」打分。
2. 顶部一块汇总区：一张近期动态趋势图 + 一句话趋势判断 + 3-5 条重点。重点点得开原文。
3. 下面自己设计，但要能按主题筛、能收藏、能看历史某一天。
4. 数据源我可以自己在 app 里管理，别写死。
5. 界面走苹果那种克制路线：留白足、层级清楚、少装饰，但动效和细节精致，黑白两套都要好看。
```

只想跑平台，不接 agent 壳：

```bash
git clone https://github.com/MungoWang/monkey-mini-app && cd monkey-mini-app
pnpm install && pnpm dev:host   # Vite :5174 · apps host :17900
```

![画廊](docs/assets/apps-list.png)

*画廊：五个 app，各自带历史。可以钉住、左右停靠、换主题、看它的存储。*

## 宿主与包

`createHost(capabilities, lifecycle)` 加 `PanelHost` 就是全部接缝。宿主实现这两个接口，
dsh 特有的东西进不了平台层。

| 包 | 角色 |
|---|---|
| [`packages/host`](packages/host) | apps、git、HTTP、编译器、`mini_app_*`、`ctx.*` |
| [`packages/panel`](packages/panel) | 管理面板（`PanelHost`） |
| [`packages/ui`](packages/ui) | UI 套件 + iframe runtime + SDK bundle |
| [`packages/api`](packages/api) | 后端 `defineApp` 合同 |
| [`packages/dsh`](packages/dsh) | dsh adapter（插件 + 客户端 + skill） |

dsh web 已经发布，pi / pi-web 是下一个：[RFC](docs/rfcs/pi-extension-port.md)。

贡献者入口：[LOCAL.md](./LOCAL.md) · [AGENTS.md](./AGENTS.md) ·
[docs/README.md](./docs/README.md)

## 信任模型

这是机主自己用的本机软件。小程序以你的身份运行：`ctx.bash`、`ctx.http`、`ctx.llm` 是
真正的宿主能力，外面没有围栏。iframe 只保证一个崩掉的视图不会带走面板，它不隔离这台
机器。本项目不限制小程序在你电脑上能做什么。

## License

MIT
