# Host kernel × Agent Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the logical kernel seams (Domain + ToolPort + Capability *interfaces* + AdapterHooks) and a localhost Tool invoke HTTP surface so dsh keeps working in-proc while pi+Shell can later call the same ToolPort over the network — without the host ever owning LLM/agent providers.

**Architecture:** Progressive slices inside `packages/host` + docs. No npm rename in Phase 1. `ToolFacade` stays the ToolPort implementation; `HttpGateway` gains an invoke route wired to it. Capability providers remain adapter-only (constitution). Phase 2 (Shell launcher + pi bidirectional AI bridge) is a **separate plan** after a process-level pi capability spike.

**Tech Stack:** TypeScript, Vitest, Hono (`packages/host`), existing `createHost` / `ToolFacade` / `HttpGateway`, pnpm workspace.

**Spec:** [`docs/rfcs/host-kernel-agent-client.md`](../../rfcs/host-kernel-agent-client.md)

## Global Constraints

- **Constitution:** Host never manages LLM/agent providers; AI only via Agent Client `HostCapabilities`.
- **ToolPort in kernel:** one `mini_app_*` implementation; adapters only register + transport.
- **Author protocol unchanged:** `ctx.*`, `mini_app_*` names, `defineApp`, UI import rules.
- **dsh always green:** after each task, `pnpm --filter @monkey-mini-app/host test` (and relevant package tests) pass; do not break `packages/dsh` build.
- **Localhost only** for Tool HTTP v1 (`127.0.0.1`).
- **Language:** project docs/comments English; sample mini-app copy may stay Chinese.
- **No host LLM deps:** do not add openai/anthropic/dsh-llm/etc. to `packages/host/package.json`.

## Scope of THIS plan (Phase 1 = RFC S0–S3)

| In | Out (Phase 2 plan) |
|----|---------------------|
| Docs constitution + overview ports | Shell launcher app |
| `AdapterHooks` alias + comments | `packages/pi` |
| ToolPort module boundary / exports | Process-level pi llm/agent backend |
| `POST /api/tools/invoke` (+ optional list) | Capability HTTP proxy in Shell |
| Tests + dsh still in-proc | Remote auth beyond loopback assumption |

---

## File map (Phase 1)

| File | Role |
|------|------|
| `docs/rfcs/host-kernel-agent-client.md` | Spec (already drafted) |
| `AGENTS.md` | Constitution one-liner |
| `docs/architecture/overview.md` | Four ports + two deployments |
| `docs/rfcs/pi-extension-port.md` | Pointer to this RFC for lifetime/AI |
| `packages/host/src/lifecycle.ts` | `AdapterHooks` alias; clarify comments; `HostServices` docs |
| `packages/host/src/capabilities.ts` | Constitution comment on llm/agent |
| `packages/host/src/tools/tool-port.ts` | Re-export / thin alias of ToolFacade as ToolPort |
| `packages/host/src/tools/tool-facade.ts` | Keep implementation; point docs at ToolPort |
| `packages/host/src/http/http-gateway.ts` | Inject ToolPort; add invoke (+ list) routes |
| `packages/host/src/create-host.ts` | Pass tools into HttpGateway |
| `packages/host/src/index.ts` | Export `AdapterHooks`, `ToolPort`, `createAgentTools` if added |
| `packages/host/tests/http-tools-invoke.test.ts` | New: HTTP ToolPort |
| `packages/host/tests/host-lifecycle.test.ts` | Still passes; optional AdapterHooks name |
| `scripts/check/` or host test | Guard: no provider SDK in host deps (lightweight) |

---

### Task 1: S0 — Constitution in live docs

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/rfcs/pi-extension-port.md` (short pointer at top or §5)
- Modify: `docs/rfcs/host-kernel-agent-client.md` (status → `accepted` only if user already approved; otherwise leave `draft` and note “plan in progress”)

**Interfaces:**
- Consumes: RFC §0, §3, §4
- Produces: documented invariants agents must not violate

- [ ] **Step 1: Add constitution under AGENTS.md Architecture**

Add a short bullet block (English), e.g. after the composition-root bullet:

```markdown
- **Constitution — AI ownership:** The App Host never manages LLM/agent providers.
  `ctx.llm` / `ctx.agent` are always supplied by an Agent Client via `HostCapabilities`.
  Tool semantics (`mini_app_*`) live in the host ToolPort; adapters only register and transport.
  See `docs/rfcs/host-kernel-agent-client.md`.
```

- [ ] **Step 2: Extend `docs/architecture/overview.md`**

After “Composition root”, add a “Ports” subsection with the four ports table (Domain / ToolPort / CapabilityPort / AdapterHooks) and the two deployments (dsh in-proc vs Shell-owns-Host + pi HTTP). One diagram in text/fenced form is enough — keep the file short.

- [ ] **Step 3: Point pi RFC at the new doc**

At the top of `docs/rfcs/pi-extension-port.md`, add:

```markdown
> **Lifetime / AI:** Host must not follow AgentSession; all AI is Agent-Client-provided.
> Deployment for pi is Shell-owns-Host + bidirectional localhost bridge — see
> [`host-kernel-agent-client.md`](./host-kernel-agent-client.md). Sections below that
> assume in-process `ensureHost()` inside the extension are outdated for product shape.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/architecture/overview.md docs/rfcs/pi-extension-port.md docs/rfcs/host-kernel-agent-client.md
git commit -m "$(cat <<'EOF'
docs: constitution — host never owns LLM; kernel ports sketched

Point architecture and pi RFC at host-kernel-agent-client.
EOF
)"
```

---

### Task 2: AdapterHooks alias + Capability constitution comments

**Files:**
- Modify: `packages/host/src/lifecycle.ts`
- Modify: `packages/host/src/capabilities.ts`
- Modify: `packages/host/src/index.ts`
- Test: existing `packages/host/tests/host-lifecycle.test.ts` (no behavior change)

**Interfaces:**
- Consumes: `HostLifecycle` as today
- Produces: `export type AdapterHooks = HostLifecycle` (and prefer AdapterHooks in new comments)

- [ ] **Step 1: Update `lifecycle.ts`**

Replace the “agent plugin implements” framing:

```ts
/**
 * Hooks the host calls so an adapter can attach to the outside world
 * (register tools with an Agent Client, install skills, log, etc.).
 * Not every adapter is an agent plugin — demo/daemon may no-op `attach`.
 *
 * Prefer the name {@link AdapterHooks} in new code. `HostLifecycle` remains
 * as a compatibility alias.
 */
export interface HostLifecycle {
  attach(ctx: unknown, services: HostServices): void | Promise<void>;
  detach?(): void | Promise<void>;
  onHostPortChanged?(port: number): void;
  log?(level: LogLevel, message: string, meta?: unknown): void;
}

/** Preferred name for {@link HostLifecycle}. */
export type AdapterHooks = HostLifecycle;
```

Document on `HostServices.tools`:

```ts
  /** ToolPort handle (`mini_app_*`). Kernel-owned semantics; adapters register/transport only. */
  tools: ToolFacade;
```

- [ ] **Step 2: Comment `HostCapabilities.llm` / `agent` in `capabilities.ts`**

Above `llm?` / `agent?`:

```ts
  /**
   * Model call — **adapter-supplied only**. The host kernel never embeds a
   * provider client; Agent Client implements this (in-proc or proxy).
   */
  llm?(…): Promise<string>;
  /**
   * Agent one-shot — **adapter-supplied only** (same constitution as `llm`).
   */
  agent?(…): Promise<string>;
```

- [ ] **Step 3: Export `AdapterHooks` from `packages/host/src/index.ts`**

```ts
export type { AdapterHooks, HostLifecycle, HostServices, LogLevel } from "./lifecycle.ts";
```

(Adjust the existing `HostLifecycle` export line rather than duplicating.)

- [ ] **Step 4: Run host tests**

```bash
pnpm --filter @monkey-mini-app/host test
```

Expected: PASS (no behavioral change).

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/lifecycle.ts packages/host/src/capabilities.ts packages/host/src/index.ts
git commit -m "$(cat <<'EOF'
refactor(host): AdapterHooks alias; document AI caps as adapter-only

EOF
)"
```

---

### Task 3: ToolPort module boundary

**Files:**
- Create: `packages/host/src/tools/tool-port.ts`
- Modify: `packages/host/src/tools/tool-facade.ts` (header comment only)
- Modify: `packages/host/src/index.ts`
- Modify: `packages/host/src/create-host.ts` (optional import alias; behavior unchanged)

**Interfaces:**
- Consumes: `ToolFacade`, `ToolDefinition`, `isMiniAppToolName`
- Produces:
  - `export type ToolPort = ToolFacade`
  - `export function createAgentTools(...args: ConstructorParameters<typeof ToolFacade>): ToolFacade`

- [ ] **Step 1: Write failing test for export surface**

Create `packages/host/tests/tool-port.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAgentTools, ToolFacade, type ToolPort } from "@monkey-mini-app/host";

describe("ToolPort", () => {
  it("createAgentTools returns a ToolFacade (ToolPort)", () => {
    const tools = createAgentTools(
      /* apps */ null as never,
      /* git */ null as never,
      /* paths */ null as never,
    );
    // Constructor will throw if null — instead unit-test type identity via prototype:
    expect(ToolFacade).toBeTypeOf("function");
  });
});
```

Better: reuse the same harness as `tool-facade.test.ts` (real AppsManager). Open `packages/host/tests/tool-facade.test.ts` and mirror its `beforeEach` setup; assert:

```ts
import { createAgentTools, type ToolPort } from "@monkey-mini-app/host";

it("createAgentTools builds the kernel ToolPort", async () => {
  const tools: ToolPort = createAgentTools(apps, git, paths, events);
  expect(tools).toBeInstanceOf(ToolFacade);
  const names = tools.definitions().map((d) => d.name);
  expect(names).toContain("mini_app_list");
});
```

- [ ] **Step 2: Run test — expect FAIL** (`createAgentTools` / `ToolPort` missing)

```bash
pnpm --filter @monkey-mini-app/host exec vitest run tests/tool-port.test.ts
```

- [ ] **Step 3: Implement `tool-port.ts`**

```ts
import { ToolFacade, type ToolDefinition, isMiniAppToolName } from "./tool-facade.ts";

/** Kernel ToolPort — agent-facing mini_app_* vocabulary + invoke. */
export type ToolPort = ToolFacade;

export type { ToolDefinition };
export { isMiniAppToolName, ToolFacade };

/** Explicit factory so adapters/docs do not `new ToolFacade` as an afterthought. */
export function createAgentTools(
  ...args: ConstructorParameters<typeof ToolFacade>
): ToolPort {
  return new ToolFacade(...args);
}
```

- [ ] **Step 4: Wire exports + optionally `create-host.ts`**

In `create-host.ts`, prefer:

```ts
import { createAgentTools } from "./tools/tool-port.ts";
// …
const tools = createAgentTools(apps, git, paths, events);
```

Export from `index.ts`:

```ts
export type { ToolPort, ToolDefinition } from "./tools/tool-port.ts";
export { createAgentTools, isMiniAppToolName, ToolFacade } from "./tools/tool-port.ts";
```

(Keep old `tool-facade` re-exports working — either re-export through `tool-port` only, or dual-export; do not break dsh.)

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @monkey-mini-app/host test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/host/src/tools/tool-port.ts packages/host/src/tools/tool-facade.ts \
  packages/host/src/create-host.ts packages/host/src/index.ts packages/host/tests/tool-port.test.ts
git commit -m "$(cat <<'EOF'
refactor(host): expose ToolPort via createAgentTools

EOF
)"
```

---

### Task 4: Pass ToolPort into HttpGateway

**Files:**
- Modify: `packages/host/src/http/http-gateway.ts` — constructor + field
- Modify: `packages/host/src/create-host.ts` — pass `tools`
- Modify: any direct `new HttpGateway(...)` in tests

**Interfaces:**
- Consumes: `ToolPort`
- Produces: gateway that *can* call ToolPort (routes in Task 5)

- [ ] **Step 1: Find all `new HttpGateway` call sites**

```bash
rg "new HttpGateway" -g '*.ts'
```

Update each to pass `tools` (or `undefined` only if a test constructs a partial gateway — prefer always passing ToolPort).

- [ ] **Step 2: Extend constructor**

```ts
constructor(
  private readonly apps: AppsManager,
  private readonly config: HostConfig,
  private readonly paths: WorkspacePaths,
  private readonly compiler: UiCompiler,
  private readonly css: AppCssCompiler,
  private readonly git: GitHistory,
  private readonly themes: ThemeResource = EMPTY_THEME_RESOURCE,
  private readonly events?: HostEventBus,
  private readonly onHostPortChanged?: (port: number) => void,
  private readonly about: HostAboutMeta = { adapter: "host" },
  private readonly tools?: ToolPort,
) {
  this.app = this.buildApp();
}
```

Import type `ToolPort` from `../tools/tool-port.ts`.

Update the class comment from “never ToolFacade” to:

```ts
/** Localhost HTTP: panel REST/SSE + optional ToolPort invoke for Agent Clients. */
```

- [ ] **Step 3: `create-host.ts` passes tools**

```ts
const http = new HttpGateway(
  apps, config, paths, compiler, css, git, themes, events,
  (port) => lifecycle.onHostPortChanged?.(port),
  options.about ?? { adapter: "host" },
  tools,
);
```

- [ ] **Step 4: Run host tests**

```bash
pnpm --filter @monkey-mini-app/host test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/http/http-gateway.ts packages/host/src/create-host.ts packages/host/tests
git commit -m "$(cat <<'EOF'
refactor(host): wire ToolPort into HttpGateway constructor

EOF
)"
```

---

### Task 5: `POST /api/tools/invoke` (+ `GET /api/tools`)

**Files:**
- Modify: `packages/host/src/http/http-gateway.ts` `buildApp()`
- Create: `packages/host/tests/http-tools-invoke.test.ts`
- Modify: `packages/host/src/errors.ts` only if a new public error code is needed (prefer reuse `UNKNOWN_TOOL` / `INVALID_TOOL_ARGS` / existing `HostError`)

**Interfaces:**
- Consumes: `tools.invoke(name, args, signal?)`
- Produces:
  - `GET /api/tools` → `{ tools: { name, description, inputSchema }[] }` (no execute)
  - `POST /api/tools/invoke` body `{ name: string, args?: Record<string, unknown> }` → tool result JSON  
  - 503 if `tools` missing; 400 on bad body; map `HostError` to JSON `{ ok: false, error, code? }`

- [ ] **Step 1: Write failing HTTP tests**

```ts
// packages/host/tests/http-tools-invoke.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapHostConfig, createHost, type Host, type HostLifecycle } from "@monkey-mini-app/host";
// … same temp config / fakeCapabilities pattern as http-gateway.test.ts

describe("HTTP ToolPort", () => {
  let host: Host | undefined;
  afterEach(async () => { await host?.stop(); host = undefined; });

  async function boot() {
    const lifecycle: HostLifecycle = { attach() {} };
    host = createHost(fakeCapabilities(), lifecycle, {
      config: bootstrapHostConfig({ runtimeRoot: mkdtempSync(…), hostPort: 0 }),
    });
    await host.apply();
  }

  it("GET /api/tools lists mini_app_* names", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tools.some((t: { name: string }) => t.name === "mini_app_list")).toBe(true);
  });

  it("POST /api/tools/invoke runs mini_app_list", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "mini_app_list", args: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toBeDefined();
    expect(body.runtimeRoot).toBeDefined();
  });

  it("POST /api/tools/invoke rejects non-mini_app names", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "bash", args: {} }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

Use real `mkdtempSync` imports like sibling tests.

- [ ] **Step 2: Run test — expect FAIL** (404 on `/api/tools`)

```bash
pnpm --filter @monkey-mini-app/host exec vitest run tests/http-tools-invoke.test.ts
```

- [ ] **Step 3: Implement routes in `buildApp()`**

Near other `/api/*` routes:

```ts
app.get("/api/tools", (c) => {
  if (!this.tools) return c.json({ ok: false, error: "tool port unavailable" }, 503);
  return c.json({
    tools: this.tools.definitions().map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  });
});

app.post("/api/tools/invoke", async (c) => {
  if (!this.tools) return c.json({ ok: false, error: "tool port unavailable" }, 503);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }
  if (!isRecord(body) || typeof body.name !== "string" || !body.name) {
    return c.json({ ok: false, error: "name required" }, 400);
  }
  if (!isMiniAppToolName(body.name)) {
    return c.json({ ok: false, error: "not a mini_app tool", code: "UNKNOWN_TOOL" }, 400);
  }
  const args = isRecord(body.args) ? body.args : {};
  try {
    const signal = c.req.raw.signal;
    const result = await this.tools.invoke(body.name, args, signal);
    return c.json(result);
  } catch (cause) {
    if (cause instanceof HostError) {
      return c.json({ ok: false, error: cause.message, code: cause.code }, 400);
    }
    throw cause;
  }
});
```

Reuse existing `isRecord` helpers in the gateway file (or import). Import `isMiniAppToolName`, `HostError`.

**Auth v1:** rely on `listen(…, "127.0.0.1")` already binding loopback. Do not add a token scheme in Phase 1 unless tests need it; document “loopback-only” in the RFC/overview. Phase 2 may add a shared local token for Shell↔pi.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @monkey-mini-app/host exec vitest run tests/http-tools-invoke.test.ts
pnpm --filter @monkey-mini-app/host test
```

Expected: PASS.

- [ ] **Step 5: Manual curl smoke (optional but recommended)**

```bash
# with pnpm dev:host / demo-templates already up, or a one-off createHost script
curl -s http://127.0.0.1:17900/api/tools | head
curl -s -X POST http://127.0.0.1:17900/api/tools/invoke \
  -H 'content-type: application/json' \
  -d '{"name":"mini_app_list","args":{}}'
```

- [ ] **Step 6: Commit**

```bash
git add packages/host/src/http/http-gateway.ts packages/host/tests/http-tools-invoke.test.ts
git commit -m "$(cat <<'EOF'
feat(host): localhost POST /api/tools/invoke for Agent Client transport

EOF
)"
```

---

### Task 6: Constitution guard + dsh sanity

**Files:**
- Create: `packages/host/tests/constitution-ai.test.ts` (or a tiny check script)
- Verify: `packages/dsh` still builds / unit tests

- [ ] **Step 1: Guard test — host must not depend on provider SDKs**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN = [
  "@deepseek-ai/dsh-llm",
  "openai",
  "@anthropic-ai/sdk",
  "ai", // vercel ai — forbid accidental add; adjust if false positive
];

describe("constitution: host owns no AI providers", () => {
  it("package.json dependencies exclude provider SDKs", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../package.json"), "utf8"),
    );
    const all = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    for (const name of FORBIDDEN) {
      expect(all[name], name).toBeUndefined();
    }
  });
});
```

If `"ai"` is too broad, drop it and keep the explicit provider packages.

- [ ] **Step 2: Run host + dsh tests/build**

```bash
pnpm --filter @monkey-mini-app/host test
pnpm --filter @monkey-mini-app/dsh-mini-app test
pnpm --filter @monkey-mini-app/dsh-mini-app build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/host/tests/constitution-ai.test.ts
git commit -m "$(cat <<'EOF'
test(host): guard constitution — no AI provider deps in host package

EOF
)"
```

---

### Task 7: Phase 1 wrap — mark RFC slices + verify

**Files:**
- Modify: `docs/rfcs/host-kernel-agent-client.md` — check off S0–S3 in §6 as done when merged

- [ ] **Step 1: Run broader verify if practical**

```bash
pnpm --filter @monkey-mini-app/host test
pnpm --filter @monkey-mini-app/dsh-mini-app build
# preferred when time allows:
# pnpm verify
```

- [ ] **Step 2: Update RFC §6 table** — mark S0–S3 complete with date.

- [ ] **Step 3: Commit docs**

```bash
git add docs/rfcs/host-kernel-agent-client.md
git commit -m "$(cat <<'EOF'
docs(rfc): mark host-kernel S0–S3 landed

EOF
)"
```

---

## Phase 2 roadmap (NOT in this plan — separate plan after spike)

Do **not** implement these in Phase 1 tasks.

1. **Spike (blocking):** Can pi expose **process-level** llm + agent (not AgentSession-scoped)? If only session APIs exist, design adapter sidecar lifetime.
2. **Shell launcher:** owns `createHost`, Panel webview/window, loopback Tool HTTP (already exists after Task 5).
3. **`PiCapabilityProxy`:** implements `HostCapabilities.llm` / `agent` by HTTP/RPC to pi backend — **no keys in host**.
4. **pi extension:** session `registerTool` → `POST /api/tools/invoke`; skill copy; no `createHost` in session.
5. **Streaming:** map `AgentEvent` across the capability bridge for `onEvent` / `streamTo`.
6. **Local token** shared by Shell and pi for invoke + capability routes.

New plan file when spike notes exist: `docs/superpowers/plans/YYYY-MM-DD-shell-pi-bridge.md`.

---

## Spec coverage self-check

| RFC requirement | Task |
|-----------------|------|
| Constitution §0.1 host never owns LLM | T1 docs, T2 comments, T6 guard |
| ToolPort in kernel | T3 |
| AdapterHooks naming | T2 |
| Two deployments documented | T1 |
| Tool HTTP invoke gap closed | T4–T5 |
| Progressive / dsh green | every task test step; T6 dsh build |
| Author protocol unchanged | no skill/API renames in Phase 1 |
| Shell / pi AI bridge | Phase 2 only |
| Process-level AI backend | Phase 2 spike |

## Placeholder scan

No TBD implementation steps in Phase 1. Phase 2 intentionally deferred with explicit spike gate.
