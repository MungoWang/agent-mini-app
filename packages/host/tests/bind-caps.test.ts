import { describe, expect, it, vi } from "vitest";

import type { AppCallContext } from "../src/app-runtime.ts";
import { bindCapsToContext, type HostCapabilities } from "../src/capabilities.ts";
import { DEFAULT_LLM_MAX_TOKENS } from "../src/model-call.ts";

describe("bindCapsToContext", () => {
  const callCtx: AppCallContext = {
    appId: "com.example.x",
    appDir: "/tmp/com.example.x",
  };

  it("forwards ctx as the first argument to each cap", async () => {
    const agent = vi.fn(async (_ctx: AppCallContext, goal: string) => `ok:${goal}`);
    const bash = vi.fn(async (_ctx: AppCallContext, command: string) => ({
      stdout: command,
      stderr: "",
      exitCode: 0,
    }));
    const credentials = vi.fn((_ctx: AppCallContext) => ({ k: "v" }));
    const config = vi.fn((_ctx: AppCallContext) => ({ theme: "dark" }));
    const listTools = vi.fn((_ctx: AppCallContext) => [{ name: "bash" }]);
    const caps: HostCapabilities = { agent, bash, credentials, config, listTools };
    const bound = bindCapsToContext(callCtx, caps);

    await expect(bound.agent("hi")).resolves.toBe("ok:hi");
    // The host owns one option: the output ceiling, applied so no adapter guesses it.
    expect(agent).toHaveBeenCalledWith(callCtx, "hi", { maxTokens: DEFAULT_LLM_MAX_TOKENS });

    await expect(bound.bash("uname")).resolves.toMatchObject({ stdout: "uname", exitCode: 0 });
    expect(bash).toHaveBeenCalledWith(callCtx, "uname");

    expect(bound.credentials()).toEqual({ k: "v" });
    expect(credentials).toHaveBeenCalledWith(callCtx);
    expect(bound.config()).toEqual({ theme: "dark" });
    expect(config).toHaveBeenCalledWith(callCtx);
    expect(bound.listTools()).toEqual([{ name: "bash" }]);
    expect(listTools).toHaveBeenCalledWith(callCtx);
  });

  it("throws when a bound capability is missing", async () => {
    const bound = bindCapsToContext(callCtx, {});
    await expect(bound.llm("x")).rejects.toThrow(/llm/);
    expect(bound.credentials()).toEqual({});
    expect(bound.config()).toEqual({});
    expect(bound.listTools()).toEqual([]);
  });

  it("ctx.push forwards (name, data) with the call context", () => {
    const push = vi.fn((_ctx: AppCallContext, name: string, data?: unknown) => calls.push([name, data]));
    const calls: [string, unknown][] = [];
    const bound = bindCapsToContext(callCtx, { push });

    bound.push("progress", { pct: 50 });
    expect(calls).toEqual([["progress", { pct: 50 }]]);
    expect(push.mock.calls[0][0]).toBe(callCtx);
  });

  it("ctx.push swallows a missing capability instead of failing the API call", () => {
    const bound = bindCapsToContext(callCtx, {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => bound.push("progress")).not.toThrow();
    // no capability at all → not even a warn (push is optional)
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ctx.push reports a throwing capability without rethrowing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bound = bindCapsToContext(callCtx, {
      push: () => {
        throw new Error("bus down");
      },
    });
    expect(() => bound.push("progress", 1)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("agent opts.streamTo mirrors progress onto ctx.push", async () => {
    const seen: unknown[] = [];
    const agent = vi.fn(async (_ctx: AppCallContext, _goal: string, opts?: { onEvent?: (e: unknown) => void }) => {
      opts?.onEvent?.({ type: "status", status: "running" });
      opts?.onEvent?.({ type: "done", text: "hi" });
      return "hi";
    });
    const bound = bindCapsToContext(callCtx, {
      agent,
      push: (_ctx, name, data) => seen.push([name, data]),
    });

    await expect(bound.agent("go", { streamTo: "agent" })).resolves.toBe("hi");
    expect(seen).toEqual([
      ["agent", { type: "status", status: "running" }],
      ["agent", { type: "done", text: "hi" }],
    ]);
  });

  it("streamTo keeps the caller's own onEvent working first", async () => {
    const order: string[] = [];
    const agent = vi.fn(async (_ctx: AppCallContext, _goal: string, opts?: { onEvent?: (e: unknown) => void }) => {
      opts?.onEvent?.({ type: "done", text: "x" });
      return "x";
    });
    const bound = bindCapsToContext(callCtx, {
      agent,
      push: () => order.push("push"),
    });
    await bound.agent("go", {
      streamTo: "agent",
      onEvent: () => order.push("onEvent"),
    });
    expect(order).toEqual(["onEvent", "push"]);

    // a broken observer must not abort the run or skip the mirror
    order.length = 0;
    const throwing = bindCapsToContext(callCtx, {
      agent,
      push: () => order.push("push"),
    });
    await expect(
      throwing.agent("go", { streamTo: "agent", onEvent: () => {
        throw new Error("bad observer");
      } }),
    ).resolves.toBe("x");
    expect(order).toEqual(["push"]);
  });

  it("without streamTo the author's opts reach the adapter as they were, plus the host budget", async () => {
    const agent = vi.fn(async () => "ok");
    const push = vi.fn();
    const bound = bindCapsToContext(callCtx, { agent, push });
    const opts = { maxIterations: 3 };
    await bound.agent("go", opts);
    expect(agent).toHaveBeenCalledWith(callCtx, "go", {
      ...opts,
      maxTokens: DEFAULT_LLM_MAX_TOKENS,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("an author-set maxTokens is never replaced", async () => {
    const seen: Array<Record<string, unknown> | undefined> = [];
    const agent = vi.fn(async (_ctx: AppCallContext, _goal: string, opts?: Record<string, unknown>) => {
      seen.push(opts);
      return "ok";
    });
    const bound = bindCapsToContext(callCtx, { agent });
    await bound.agent("go", { maxTokens: 300 });
    expect(seen[0]).toMatchObject({ maxTokens: 300 });
  });

  it("keeps `this` for class-shaped adapters (dsh puts methods on the prototype)", async () => {
    // Canary for the 8f8ad0f regression: destructuring llm/agent off caps loses the receiver,
    // and the next line inside DshCapabilities (`this.dsh`) throws
    // "Cannot read properties of undefined (reading 'dsh')". Object-literal caps hide it.
    class Caps {
      constructor(private readonly tag: string) {}
      async llm(_ctx: AppCallContext, prompt: string): Promise<string> {
        return `${this.tag}:${prompt}`;
      }
      async agent(_ctx: AppCallContext, goal: string): Promise<string> {
        return `${this.tag}:${goal}`;
      }
    }
    const caps = new Caps("bound") as unknown as HostCapabilities;
    const bound = bindCapsToContext(callCtx, caps);
    await expect(bound.llm("hi")).resolves.toBe("bound:hi");
    await expect(bound.agent("go")).resolves.toBe("bound:go");
  });
});
