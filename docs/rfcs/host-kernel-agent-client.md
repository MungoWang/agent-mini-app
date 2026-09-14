# Host kernel × Agent Client

> Date: 2026-09-14  
> Status: **implemented (kernel + dsh migration + pi package + Tauri shell)** — live AI→pi model bridge still uses injectable `PiAiDriver` (echo/unavailable stubs until desktop APIs are pinned)  
> Related: [`pi-extension-port.md`](./pi-extension-port.md) (process shape / AI ownership superseded here where they conflict)

High-level architecture only: packages, ownership, startup, transports, interfaces. Not a task checklist.

---

## 0. Settled decisions (ambiguity check)

| Topic | Decision |
|-------|----------|
| AI ownership | Host **never** implements llm/agent; **Agent Client** always provides |
| Rename | `HostCapabilities` → **`AgentCapabilities`** (host consumes, client provides) |
| CapBackend as its own capability API | **Rejected** — only wire encoding under http transport |
| Agent Client | **Keep** as adapter-side **aggregate** (caps + tool/skill registration + session); not dissolved into loose helpers |
| Product-named factories | **No** `createDshAgentClient` / `createPiAgentClient` as public abstract API |
| Product differences | **DI** into shared ports (`AgentCapabilities`, `ToolRegistrarPort`, …) |
| `createHost` | **One** kernel factory; Agent layer does not create the host as its primary verb |
| Design order | **pi (cross-process) first**; dsh is a polymorphic in-proc transport of the **same** model |
| Caps transport | Unified **`serve` / `connect`**; in-proc = **identity** (no transparent proxy wrapper) |
| `connect` return | Always `AgentCapabilities`; in-proc returns the real impl; http returns a proxy that implements the same interface |
| Tools | Kernel **ToolPort** once; access via inproc `ToolPort` \| http `ToolClient`; registrar is Client-side |
| Deployments | **A** dsh co-located; **B** Shell owns Host, pi is Agent Client only |
| Panel | Separate from Agent Client (dsh `./client` / Shell window); talks HTTP to Host |

**Non-blocking open points** (do not block this RFC): Shell stack (Tauri vs Electron vs browser+daemon); exact HTTP paths/tokens for caps wire; whether `bash` on pi is Client-provided day one or deferred; when to split `host-protocol` npm package.

---

## 1. Constitution

1. **Host never owns AI.** No provider SDKs, API keys, or model registry inside `packages/host` or Shell product defaults.
2. **`AgentCapabilities` is the only capability port.** Implementors are Agent Clients (or an http `connect` proxy to one). There is no second “CapBackend capabilities” type.
3. **Tool semantics (`mini_app_*`) live once in the kernel ToolPort.** Clients register and transport only.
4. **Author protocol stays stable:** `defineApp`, `@monkey-mini-app/ui`, `ctx.*` shapes, tool names.

---

## 2. Roles

| Role | Responsibility |
|------|----------------|
| **Host (kernel)** | AppsManager, compile, git, events, HttpGateway (panel + tool invoke), `createHost`, binds `AgentCapabilities` into `ctx.*` (retry / `streamTo` policy). **Does not** call models. |
| **Agent Client** | Aggregate: provide `AgentCapabilities`, register tools with the outer agent product, install skills, session attach/detach, dispose. **Does not** own AppsManager / listen (except dsh composition root also starts Host). |
| **Shell** | Split-deploy **Host owner**: process entry, `createHost`, Panel window. Uses `connect` for caps; does not implement AI. |
| **Panel** | UI chrome over Host HTTP/SSE only. |
| **Transport** | How Host obtains `AgentCapabilities` and how Client obtains ToolPort access — in-proc or http — **same interface model**. |

---

## 3. Packages

| Package | Role |
|---------|------|
| `@monkey-mini-app/host` | Kernel ( Domains + ToolPort + HttpGateway + `AgentCapabilities` **types** + bind/retry). No AI provider. |
| `@monkey-mini-app/panel` | Panel UI |
| `@monkey-mini-app/ui` / `api` | Author surface |
| `@monkey-mini-app/dsh-mini-app` | Agent Client ports + composition root that also `createHost` + Panel inject |
| `@monkey-mini-app/shell` *(new)* | Host process for split deploy + Panel |
| `@monkey-mini-app/pi-mini-app` *(new)* | Agent Client only — **no** `createHost` |

Optional later: `host/client` or `@monkey-mini-app/host-protocol` for `ToolClient` + caps `serve`/`connect` without Domain.

### Import graph

```text
dsh ──► host ◄── shell
         ▲
pi ──────┘  (types + ToolClient + serve/connect; never createHost)

FORBIDDEN: host → dsh|pi|shell|LLM SDKs
           pi → shell; shell → pi (discover endpoint at runtime)
           panel → host Domain
```

---

## 4. Core interfaces

### 4.1 `AgentCapabilities` (rename from `HostCapabilities`)

```ts
interface AgentCapabilities {
  bash?(
    ctx: AppCallContext,
    command: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  llm?(
    ctx: AppCallContext,
    prompt: string,
    opts?: LlmRunOptions,
  ): Promise<string>;
  agent?(
    ctx: AppCallContext,
    goal: string,
    opts?: AgentRunOptions,
  ): Promise<string>;
  tool?(
    ctx: AppCallContext,
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
  mcp?(
    ctx: AppCallContext,
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
  listTools?(ctx: AppCallContext): unknown[];
  // `push` is injected by createHost (events) — not Client AI
}
```

Migration: `export type HostCapabilities = AgentCapabilities` deprecated alias until call sites move.

### 4.2 Caps transport — `serve` / `connect` (pi-first; in-proc = identity)

One model. In-proc is not “no transport”; it is **identity**.

```ts
/** Opaque address of a published AgentCapabilities */
type AgentCapabilitiesEndpoint =
  | AgentCapabilities // in-proc: the object reference IS the endpoint
  | { url: string; token: string }; // http

interface AgentCapabilitiesTransport {
  /** Publish a local impl. In-proc: return `caps` itself. Http: listen, return { url, token }. */
  serve(caps: AgentCapabilities): MaybeAsync<AgentCapabilitiesEndpoint>;
  /**
   * Obtain AgentCapabilities for createHost.
   * In-proc: return the same caps (no wrapper proxy).
   * Http: return a proxy that implements AgentCapabilities.
   */
  connect(endpoint: AgentCapabilitiesEndpoint): AgentCapabilities;
}

type MaybeAsync<T> = T | Promise<T>;
```

```text
createHost(transport.connect(await transport.serve(caps)), …)
```

- **No** in-proc transparent proxy “for symmetry.”  
- **No** separate CapBackend capability type — http wire encodes `llm` / `agent` calls only.  
- Retry / `streamTo` / `onEvent` bridging stay in **Host** (`bindCapsToContext`); http proxy maps streams back into `AgentEvent` for the host bridge.

Http wire sketch (encoding, not a new domain):

| | |
|--|--|
| `POST /v1/caps/llm` | body ≈ prompt + serializable opts → `{ text }` |
| `POST /v1/caps/agent` | SSE of `AgentEvent`; ends with `{ type: "done", text }` |
| `POST /v1/caps/tool` / `mcp` | `{ name, args }` → `{ result }` |
| `GET /v1/caps/list-tools` | hydrate sync `listTools()` on connect |
| `POST /v1/caps/_streaming/cancel` | `{ runId }` — **transport-internal** (AbortSignal), not a public caps method |
| Auth | loopback + bearer token |

### 4.3 Host factory

```ts
function createHost(
  capabilities: AgentCapabilities, // always already connect()'d
  hooks: AdapterHooks,
  options: { config: HostConfig; themes?: ThemeResource; about?: HostAboutMeta },
): Host;
```

Host does **not** take a transport; the composition root calls `connect`.

### 4.4 ToolPort (kernel) + Tool access + registrar

```ts
interface ToolPort {
  definitions(): ToolDefinition[];
  invoke(
    name: string,
    args?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<unknown>;
};

/** How Agent Client reaches ToolPort */
type ToolAccess =
  | { mode: "inproc"; port: ToolPort }
  | { mode: "http"; client: ToolClient };

interface ToolClient {
  list(): Promise<
    Pick<ToolDefinition, "name" | "description" | "inputSchema">[]
  >;
  invoke(
    name: string,
    args?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

/** How definitions are hung on the outer agent product */
interface ToolRegistrarPort {
  register(definitions: ToolDefinition[]): () => void; // dispose
}
```

Host HttpGateway exposes tool transport for http `ToolClient`, e.g.:

- `GET /api/tools`
- `POST /api/tools/invoke` `{ name, args }` → `ToolPort.invoke`

(Panel REST remains separate; do not re-express every tool as ad-hoc REST.)

### 4.5 Agent Client aggregate

```ts
type AgentClientPorts = {
  capabilities: AgentCapabilities;
  tools: ToolRegistrarPort;
  skills?: SkillPort;
  session?: SessionPort;
};

interface SkillPort {
  install(sourceDir: string): void;
}

interface SessionPort {
  onSession?(handlers: {
    attach: () => void;
    detach: () => void;
  }): () => void;
}

interface AgentClient {
  readonly capabilities: AgentCapabilities;
  start(): Promise<void>;
  bindToHost(access: ToolAccess): void;
  dispose(): void;
}

/** Generic assembler — no product name in the API */
function createAgentClient(ports: AgentClientPorts): AgentClient;
```

`bindToHost`: resolve definitions from `ToolPort` or `ToolClient.list`, bind `execute` to invoke, call `tools.register`.

Adapter packages export **port implementations** (and composition roots), not `createDshAgentClient`.

### 4.6 AdapterHooks

```ts
interface AdapterHooks {
  attach(ctx: unknown, services: HostServices): void | Promise<void>;
  detach?(): void | Promise<void>;
  onHostPortChanged?(port: number): void;
  log?(level: LogLevel, message: string, meta?: unknown): void;
}

type HostServices = {
  apps: AppsManager;
  git: GitHistory;
  tools: ToolPort;
  paths: WorkspacePaths;
  config: HostConfig;
  events: HostEventBus;
};
```

Preferred name vs today’s `HostLifecycle` (alias during migration).  
Tool registration should converge on `agent.bindToHost(...)`; hooks may stay thin (log / port notify) or call bind for backward-compatible dsh attach.

---

## 5. Deployments

### 5.1 Design narrative: pi first

```text
pi process                              Shell process
─────────                              ─────────────
caps = PiAgentCapabilities(...)        endpoint = discover() // { url, token }
agent = createAgentClient({            caps = httpTransport.connect(endpoint)
  capabilities: caps,                  host = createHost(caps, shellHooks, opts)
  tools: PiToolRegistrar,              host.apply(); open Panel
  skills, session,
})
await agent.start()
endpoint = await httpTransport.serve(caps)   // process-level
// publish endpoint for Shell
session → agent.bindToHost({
  mode: "http",
  client: toolClient(hostUrl),
})
```

- Host lifetime ≠ AgentSession; caps **serve** is process-level.  
- pi never calls `createHost`.

### 5.2 dsh — same model, in-proc transport

```text
caps = DshAgentCapabilities(ctx)          // implements AgentCapabilities
agent = createAgentClient({
  capabilities: caps,
  tools: DshToolRegistrar(ctx),
  skills: DshSkillPort(...),
})
endpoint = inprocTransport.serve(caps)    // === caps
host = createHost(inprocTransport.connect(endpoint), hooks, opts)  // === caps
await host.apply()
agent.bindToHost({ mode: "inproc", port: host.services.tools })
// Panel via dsh ./client
```

Same sequence as pi/Shell; transport is identity. **No** Host API fork.

### 5.3 Binding summary

| | Tools (Client → Host) | Caps (Host → Client) |
|--|----------------------|----------------------|
| in-proc (dsh) | `ToolPort` | `serve`/`connect` identity |
| http (pi↔Shell) | `ToolClient` → Host `/api/tools/*` | `serve` listen / `connect` proxy |

---

## 6. Code layout (sketch)

```text
packages/host/src/
  create-host.ts
  capabilities.ts          # AgentCapabilities + bind* (alias HostCapabilities)
  agent-capabilities-transport.ts  # Transport interface; inproc + http helpers
  lifecycle.ts             # AdapterHooks
  tools/tool-port.ts       # ToolPort / ToolFacade
  http/http-gateway.ts     # panel + /api/tools/*
  client/tool-client.ts

packages/dsh/src/
  index.ts                 # composition: createAgentClient + createHost + bind
  agent-capabilities.ts    # impl
  tool-registrar.ts
  skill-port.ts
  client/                  # panel inject

packages/shell/src/        # NEW
  main.ts                  # createHost(connect(discoveredEndpoint))
  window.ts

packages/pi/src/           # NEW
  extension.ts             # no createHost
  agent-capabilities.ts
  tool-registrar.ts
  # http serve used at process level for caps
```

---

## 7. Migration posture

1. Docs + rename alias `AgentCapabilities`; constitution in `AGENTS.md` / overview.  
2. Kernel: ToolPort naming, `/api/tools/invoke`, inproc+http transport helpers for caps.  
3. Refactor dsh composition to `createAgentClient` + `serve`/`connect` (identity) + `bindToHost` without behavior change.  
4. Add `shell` + `pi` on the pi-first path.  
5. Optional npm extract of protocol/client.

Author-facing protocol unchanged throughout.

---

## 8. One-line summary

**One Host factory, one `AgentCapabilities` port (Client-provided), one serve/connect transport (in-proc = identity; http = proxy), Agent Client as port-injected aggregate, ToolPort unique in kernel; pi defines the cross-process shape, dsh is the same shape with identity transport; Shell owns Host when the agent UI cannot.**
