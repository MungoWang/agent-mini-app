import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runDshAgentOneShot, type DshAgentHelpers } from "../src/agent-one-shot.ts";

const fakeHelpers: DshAgentHelpers = {
  SessionId: (id) => id,
  createUserMessage: (input) => ({ id: "m1", role: "user", ...input }),
  finalAssistantOutput: () => [{ type: "text", text: "hello from agent" }],
};

describe("runDshAgentOneShot", () => {
  it("throws when ctx.agents.create is missing", async () => {
    await expect(
      runDshAgentOneShot({}, "goal", undefined, { loadHelpers: async () => fakeHelpers }),
    ).rejects.toThrow(/agents factory unbound/);
  });

  it("throws when SDK helpers are unavailable", async () => {
    await expect(
      runDshAgentOneShot(
        { get: (name: string) => (name === "agents" ? { create: async () => ({}) } : undefined) },
        "goal",
        undefined,
        { loadHelpers: async () => null },
      ),
    ).rejects.toThrow(/SDK helpers unavailable/);
  });

  it("creates an ephemeral agent, follows up, folds output, and disposes", async () => {
    const dispose = vi.fn(async () => undefined);
    const followup = vi.fn();
    const whenIdle = vi.fn(async () => undefined);
    const cancel = vi.fn();
    const session = { events: [] as unknown[], append: vi.fn() };
    const restrict = vi.fn();
    const agent = {
      followup,
      whenIdle,
      cancel,
      session,
    };
    const mount = vi.fn(async () => ({ id: "standard" }));
    const create = vi.fn(
      async (opts: {
        setup?: (ctx: unknown) => Promise<{ commit?: () => void } | void> | { commit?: () => void } | void;
      }) => {
        const agentCtx = {
          agent,
          tools: {
            schemas: () => [{ name: "mini_app_list" }, { name: "bash" }],
            restrict,
          },
          get: (name: string) => (name === "agentPresets" ? { mount } : undefined),
        };
        const commit = await opts.setup?.(agentCtx);
        commit?.commit?.();
        return { agent, dispose };
      },
    );

    const out = await runDshAgentOneShot(
      {
        get: (name: string) => (name === "agents" ? { create } : undefined),
      },
      "do the thing",
      { provider: "deepseek-official", model: "deepseek-v4-flash" },
      { loadHelpers: async () => fakeHelpers },
    );

    expect(out).toBe("hello from agent");
    expect(create).toHaveBeenCalledTimes(1);
    const createArg = create.mock.calls[0]?.[0] as {
      meta?: { origin?: string };
      agentOptions?: { provider?: string; model?: string };
      sessionId?: string;
      setup?: unknown;
    };
    expect(createArg.meta).toMatchObject({ origin: "subagent" });
    expect(typeof (createArg.meta as { cwd?: string }).cwd).toBe("string");
    expect(path.isAbsolute((createArg.meta as { cwd: string }).cwd)).toBe(true);
    expect(createArg.agentOptions).toMatchObject({
      provider: "deepseek-official",
      model: "deepseek-v4-flash",
    });
    expect(typeof createArg.sessionId).toBe("string");
    expect(typeof createArg.setup).toBe("function");
    expect(mount).toHaveBeenCalledTimes(1);
    expect(restrict).toHaveBeenCalledWith({ deny: ["mini_app_list"] });
    expect(session.append).toHaveBeenCalledWith(
      "approval/policy",
      expect.objectContaining({ policy: "never" }),
    );
    expect(session.append).toHaveBeenCalledWith(
      "sandbox/mode",
      expect.objectContaining({ mode: "danger-full-access" }),
    );
    expect(followup).toHaveBeenCalledTimes(1);
    expect(whenIdle).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("emits status / live session projection / done via onEvent", async () => {
    const events: unknown[] = [];
    const session = { events };
    const whenIdle = vi.fn(async () => {
      events.push({
        type: "assistant/chunk",
        data: { chunk: { type: "text-delta", text: "hi" } },
      });
      events.push({ type: "turn/start", data: { turn: 1 } });
      await new Promise((r) => setTimeout(r, 60));
    });
    const create = vi.fn(async () => ({
      agent: {
        followup: vi.fn(),
        whenIdle,
        cancel: vi.fn(),
        session,
      },
      dispose: vi.fn(async () => undefined),
    }));
    const seen: Array<{ type: string }> = [];
    const out = await runDshAgentOneShot(
      { get: (name: string) => (name === "agents" ? { create } : undefined) },
      "goal",
      {
        onEvent: (e) => {
          seen.push(e);
        },
      },
      { loadHelpers: async () => fakeHelpers, pollMs: 10 },
    );
    expect(out).toBe("hello from agent");
    expect(seen.map((e) => e.type)).toEqual([
      "status",
      "text-delta",
      "turn",
      "status",
      "done",
    ]);
    expect(seen[0]).toEqual({ type: "status", status: "running" });
    expect(seen.at(-1)).toEqual({ type: "done", text: "hello from agent" });
  });

  it("embeds opts.schema into the followup user message", async () => {
    const followup = vi.fn();
    const create = vi.fn(async () => ({
      agent: {
        followup,
        whenIdle: vi.fn(async () => undefined),
        cancel: vi.fn(),
        session: { events: [] },
      },
      dispose: vi.fn(async () => undefined),
    }));
    const helpers: DshAgentHelpers = {
      ...fakeHelpers,
      finalAssistantOutput: () => [{ type: "text", text: '{"summary":"ok","risks":[],"nextStep":"ship"}' }],
    };
    const schema = {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    };
    const out = await runDshAgentOneShot(
      { get: (name: string) => (name === "agents" ? { create } : undefined) },
      "insight please",
      { schema },
      { loadHelpers: async () => helpers },
    );
    expect(JSON.parse(out)).toEqual({ summary: "ok", risks: [], nextStep: "ship" });
    const msg = followup.mock.calls[0]?.[0] as { content?: Array<{ text?: string }> };
    const text = msg?.content?.[0]?.text || "";
    expect(text).toContain("JSON Schema");
    expect(text).toContain("insight please");
    expect(text).toContain('"summary"');
  });

  it("empty result error includes turn/end reason and event type sequence", async () => {
    const events: unknown[] = [];
    const session = { events };
    const whenIdle = vi.fn(async () => {
      events.push({ type: "turn/start", data: { turn: 1 } });
      events.push({ type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });
    });
    const create = vi.fn(async () => ({
      agent: {
        followup: vi.fn(),
        whenIdle,
        cancel: vi.fn(),
        session,
      },
      dispose: vi.fn(async () => undefined),
    }));
    const helpers: DshAgentHelpers = {
      ...fakeHelpers,
      finalAssistantOutput: () => undefined,
    };
    await expect(
      runDshAgentOneShot(
        { get: (name: string) => (name === "agents" ? { create } : undefined) },
        "goal",
        undefined,
        { loadHelpers: async () => helpers },
      ),
    ).rejects.toThrow(/empty result.*turn\/start → turn\/end.*t1:completed/s);
  });

  it("prefers turn/end error message over generic empty result", async () => {
    const events: unknown[] = [];
    const session = { events };
    const whenIdle = vi.fn(async () => {
      events.push({ type: "step/start", data: { turn: 1, step: 1 } });
      events.push({
        type: "turn/end",
        data: {
          turn: 1,
          reason: {
            kind: "error",
            error: { code: "UNKNOWN", message: 'prompt variable "{{cwd}}" has no value' },
          },
        },
      });
    });
    const create = vi.fn(async () => ({
      agent: {
        followup: vi.fn(),
        whenIdle,
        cancel: vi.fn(),
        session,
      },
      dispose: vi.fn(async () => undefined),
    }));
    const helpers: DshAgentHelpers = {
      ...fakeHelpers,
      finalAssistantOutput: () => undefined,
    };
    await expect(
      runDshAgentOneShot(
        { get: (name: string) => (name === "agents" ? { create } : undefined) },
        "goal",
        undefined,
        { loadHelpers: async () => helpers },
      ),
    ).rejects.toThrow(/turn 1 failed: UNKNOWN: prompt variable "\{\{cwd\}\}" has no value/);
  });

  it("cancels when maxIterations turn ends are reached", async () => {
    const events: unknown[] = [];
    const session = { events };
    const cancel = vi.fn();
    const whenIdle = vi.fn(async () => {
      events.push({ type: "turn/start", data: { turn: 1 } });
      events.push({ type: "turn/end", data: { turn: 1 } });
      events.push({ type: "turn/start", data: { turn: 2 } });
      events.push({ type: "turn/end", data: { turn: 2 } });
      await new Promise((r) => setTimeout(r, 80));
    });
    const create = vi.fn(async () => ({
      agent: {
        followup: vi.fn(),
        whenIdle,
        cancel,
        session,
      },
      dispose: vi.fn(async () => undefined),
    }));
    const out = await runDshAgentOneShot(
      { get: (name: string) => (name === "agents" ? { create } : undefined) },
      "goal",
      { maxIterations: 1 },
      { loadHelpers: async () => fakeHelpers, pollMs: 10 },
    );
    expect(out).toBe("hello from agent");
    expect(cancel).toHaveBeenCalled();
  });

  it("cancels and disposes when signal aborts before followup", async () => {
    const dispose = vi.fn(async () => undefined);
    const cancel = vi.fn();
    const create = vi.fn(async () => ({
      agent: {
        followup: vi.fn(),
        whenIdle: vi.fn(async () => undefined),
        cancel,
        session: { events: [] },
      },
      dispose,
    }));
    const signal = AbortSignal.abort();
    await expect(
      runDshAgentOneShot(
        { get: (name: string) => (name === "agents" ? { create } : undefined) },
        "goal",
        { signal },
        { loadHelpers: async () => fakeHelpers },
      ),
    ).rejects.toThrow(/cancelled/);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
