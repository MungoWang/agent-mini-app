# `ctx.agent` 能力契约与演进（流式 / 多样性）

> 日期：2026-08-29  
> 现状：dsh 已落地 **one-shot → `Promise<string>`**，并支持可选 **`opts.onEvent`** 过程投影（`packages/dsh/src/agent-one-shot.ts` + `agent-event-project.ts`；类型在 `packages/host/src/agent-events.ts`）。

## 1. 现状为什么会显得「扩展不够」

当前端口（`HostCapabilities`）：

```ts
agent?(goal: string, opts?: Record<string, unknown>): Promise<string>;
```

Skill 契约同样是 **返回最终 string**。这适合：

- 「帮我一句话洞察 / 总结」
- capability lab 冒烟
- 后台跑完再 `storage` + UI 轮询

**不适合（多样 app 很快会碰到）：**

- 过程时间线（turn / tool start / tool result）
- token 级或段落级流式渲染
- 可取消的中途 UI（不只 abort 整次调用）
- 结构化中间态（计划、待确认、分支）

根因不是「没用 dsh SDK」，而是 **把丰富的 Agent 运行时压成了一个标量返回值**。dsh 侧其实有 session events、`assistant/chunk`、tool pipeline——我们 one-shot 只在 `whenIdle` 后折了最终文本。

## 2. 设计原则

1. **不破坏一期契约**：`await ctx.agent(goal)` 仍是最终 string。  
2. **过程是可选观测面**，不是第二个并行 runtime。  
3. **事件形状 host 拥有、实现可映射**：dsh 把 SDK session/agent 事件 **投影** 成 MMA 事件；PI 以后投影自己的。  
4. **禁止**用多次 `ctx.llm` 假装 harness；过程流也必须来自真 agent 运行时。  
5. UI 与后端解耦：app 用 `onEvent` 写 storage / `push`；UI 轮询或（未来）订阅。

## 3. 目标契约（已选 A）

### 3.0 结构化 JSON（一期已有，与 llm 对齐）

`opts.schema` 对 **llm / agent 都可用**（软约束 + `coerceSchemaJson`；返回仍是 string，app `JSON.parse`）。

类型在 host：`ModelCallOptions` / `LlmRunOptions` / `AgentRunOptions`（`packages/host/src/model-call.ts`、`agent-events.ts`）——最小已知字段显式声明，宿主可用 interface 扩展，**禁止**整包 `Record<string, unknown>` 糊弄。

- Skill 说明与双端例子：`packages/dsh/skills/monkey-mini-app/references/llm-json.md`
- **不是**默认每次结构化，也 **不是** provider 原生 JSON mode / 校验重试（二期可选加强）

```ts
const raw = await ctx.agent(goal, { schema: MY_SCHEMA });
const obj = JSON.parse(raw);
```

### 3.1 保留

```ts
const text = await ctx.agent(goal, opts); // 最终答案 string
```

### 3.2 可选观测（已落地：`onEvent`）

```ts
type AgentEvent =
  | { type: "status"; status: "running" | "idle" }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string; args?: unknown; result?: unknown }
  | { type: "turn"; phase: "start" | "end"; turn: number }
  | { type: "error"; message: string }
  | { type: "done"; text: string };

await ctx.agent(goal, {
  schema?,
  onEvent: (ev) => { /* storage / state */ },
});
```

dsh 实现：轮询 ephemeral `session.events` 增长并投影（不依赖 cordis `ctx.on`）。无 `onEvent` 时与原先行为一致。

**尚未做：** `AsyncIterable` / `agentStream` 语法糖；`maxIterations` 硬限制。

### 3.3 `opts` 表

| opts | 状态 |
|------|------|
| `provider` / `model` / `maxTokens` | ✅ |
| `system` / `schema` | ✅ |
| `signal` | ✅（apps 调用会合并 `ctx.signal`） |
| `onEvent` | ✅ |
| `stream: true` / `agentStream` | 未做（可选后续） |
| `maxIterations` | 未保证 |

## 4. dsh 实现怎么接（不摸瞎）

One-shot 编排不变：`create → followup → whenIdle → dispose`。

**create meta 硬要求（对齐 dsh agent-loop / web persona）：**

| 字段 | 来源 | 缺了会怎样 |
|------|------|------------|
| `meta.cwd` | `resolveAgentCwd(opts, { appDir: callCtx.appDir })` | `{{cwd}}` 插值失败 |
| `agentOptions.provider` / `model` | `resolveLlmRoute(opts, callCtx.hostLlm)` | `{{model}}`/`{{provider}}` 失败 |
| `meta.origin: "subagent"` | 标记 ephemeral | 仅元数据 |

执行模型：`HostCapabilities.*(callCtx, …)`（含 `credentials` / `config` / `listTools`，便于日后 by-scope）；`bindCapsToContext` 绑到作者 `ctx.*`（作者侧 `credentials`/`config` 仍是属性 getter）。**用户 opts 不 merge**；`signal` / `appDir` 来自 `AppCallContext`（与 `ctx.appId`/`ctx.appDir`/`ctx.signal` 同源）。

**one-shot 组成（`agents.create` setup）：** dsh 的 bash/read 挂在 **agent preset** 层（不是 global）；不 `agentPresets.mount()` 则子 agent 几乎只有 MCP/记忆等全局工具。创建时：`mount(default)` → `tools.restrict` 屏蔽 `mini_app_*` → `approval/policy=never` + `sandbox/mode=danger-full-access`（无 UI 审批）。

**`opts.cwdType` / `opts.cwd`（默认 `process`）：**

| cwdType | 含义 |
|---------|------|
| `process` | `process.cwd()` |
| `app` | `ctx.appDir` |
| `temp` | 临时目录，跑完删除 |
| `custom` | 绝对路径 `cwd` |

失败时优先抛出最后一次 `turn/end.reason`，并附带事件序列。

二期在 **idle 之前** 订阅投影源，例如：

| MMA `AgentEvent` | dsh 可能来源 |
|------------------|--------------|
| `status` | `agent/status` |
| `text-delta` | session `assistant/chunk` / text-delta |
| `tool start/end` | tools pipeline / session tool 事件 |
| `turn start/end` | `turn/start` / `turn/end` |
| `done` | `finalAssistantOutput` + Promise resolve |

要点：

- 投影放在 `packages/dsh`（或共享 `agent-events.ts` 类型在 host）  
- **类型定义在 host**（`AgentEvent`），实现只做 map  
- 没有 `onEvent` 时行为与今天完全一致（零开销可接受：可不挂监听）

## 5. mini-app 多样性怎么用

| App 类型 | 用法 |
|----------|------|
| 只要最终句 | `await ctx.agent(goal)` |
| 要过程时间线 | `onEvent` → `storage.set("trace", …)` → UI 轮询 |
| 要打字机 | `text-delta` 追加到 state / storage |
| 要可停 | 已有 `ctx.signal`；UI「停止」abort |

**不要**让 UI 直接订阅 dsh session——跨 iframe / 宿主会碎。统一走 app 后端 `onEvent` → storage/`push`。

## 6. 与 `HostCapabilities` 的关系

短期：**不必**新立 `AgentResource` 接口；在现有 `agent?` 上扩展 opts 即可（与 ThemeResource「另立端口」不同——agent 已是 capabilities 一等能力）。

若日后出现：

- 非 Promise 的长驻 agent handle  
- 多宿主事件总线差异过大  

再考虑拆 `AgentRunner` port（`run(goal, { onEvent })`），`HostCapabilities.agent` 变成薄委托。

## 7. 落地状态

1. ✅ string one-shot  
2. ✅ `AgentEvent` 类型（host）+ `onEvent`（dsh：status / turn / text-delta / tool / done / error）  
3. ✅ skill `ctx.md` 示例  
4. 可选后续：`agentStream` AsyncIterable；`maxIterations`；provider JSON mode 校验重试  

## 8. 一句话

一期 string 没错，但 **不能把「最终答案」当成唯一观测面**。目标契约是：**Promise\<string\> 不变，过程用可选 `onEvent`（或同投影的 AsyncIterable）从真 agent runtime 流出**——这样多样性 app 不会摸瞎，旧 app 也不用改。
