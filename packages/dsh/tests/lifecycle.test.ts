import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { HostServices } from "@monkey-mini-app/host";

import type { DshCtx } from "../src/ctx.ts";
import { DshLifecycle, installSkillDir, registerListCtxTools, registerTools } from "../src/lifecycle.ts";
import { getSkillDir } from "../src/skills.ts";

describe("DshLifecycle", () => {
  it("copies the skill tree to skillDest on attach", async () => {
    const dest = path.join(mkdtempSync(path.join(tmpdir(), "mma-dsh-skill-")), "monkey-mini-app");
    const provided: unknown[] = [];
    const registered: unknown[] = [];
    const ctx: DshCtx = {
      tools: {
        register: (t) => {
          registered.push(t);
        },
      },
      provide: (key, value) => {
        provided.push({ key, value });
      },
    };
    const tools = {
      definitions: () => [
        {
          name: "mini_app_list",
          description: "list",
          inputSchema: { type: "object", properties: {} },
          execute: async () => ({ apps: [] }),
        },
      ],
    };
    const services = {
      tools,
      paths: { root: "/tmp/runtime" },
      config: { hostPort: 0 },
    } as unknown as HostServices;
    const life = new DshLifecycle(ctx, { skillDest: dest });
    await life.attach(ctx, services);
    expect(existsSync(path.join(dest, "SKILL.md"))).toBe(true);
    expect(registered.some((t) => (t as { name?: string }).name === "mini_app_list")).toBe(true);
    expect(registered.some((t) => (t as { name?: string }).name === "mini_app_list_ctx_tools")).toBe(true);
    expect(provided[0]).toMatchObject({ key: "monkeyMiniApp" });
    const listed = registered.find((t) => (t as { name?: string }).name === "mini_app_list") as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
      output: { render: (a: unknown, v: unknown) => unknown };
    };
    await expect(listed.execute({})).resolves.toEqual({ apps: [] });
    expect(listed.output.render(null, { ok: true })[0]).toMatchObject({ type: "text" });
    const extra = registered.find((t) => (t as { name?: string }).name === "mini_app_list_ctx_tools") as {
      execute: (args?: Record<string, unknown>) => Promise<{ count: number }>;
      parameters?: unknown;
    };
    // defineTool compiles empty parameters to a JSON Schema object root (not type:null).
    expect(extra.parameters).toBeTruthy();
    await expect(extra.execute({})).resolves.toMatchObject({ count: expect.any(Number) });
    await life.detach();
  });

  it("installSkillDir copies SKILL.md", () => {
    const dest = path.join(mkdtempSync(path.join(tmpdir(), "mma-dsh-skill2-")), "out");
    installSkillDir(getSkillDir(), dest);
    expect(readFileSync(path.join(dest, "SKILL.md"), "utf8")).toContain("monkey-mini-app");
  });

  it("registerTools no-ops with a warning when ctx.tools is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const disposers = registerTools({}, [], null);
    expect(disposers).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("registerTools uses defineTool, records disposers, and survives register failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listed = [{ name: "bash", description: "run" }];
    const seen: Array<{ name?: string; execute?: (a: Record<string, unknown>) => Promise<unknown>; output?: { render: (a: unknown, v: unknown) => unknown } }> = [];
    const ctx: DshCtx = {
      tools: {
        register: (t) => {
          const tool = t as { name?: string; execute?: (a: Record<string, unknown>) => Promise<unknown>; output?: { render: (a: unknown, v: unknown) => unknown } };
          seen.push(tool);
          if (tool.name === "boom") throw new Error("nope");
          return () => undefined;
        },
        list: () => listed,
      },
    };
    const defineTool = (opts: Record<string, unknown>) => ({ ...opts, defined: true });
    const disposers = registerTools(
      ctx,
      [
        {
          name: "mini_app_list",
          description: "list",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string", description: "app" } },
            required: ["id"],
          },
          execute: async () => ({ ok: true }),
        },
        { name: "boom", description: "x", inputSchema: { type: "object", properties: {} } },
        { name: "noexec", description: "x", inputSchema: { type: "object", properties: {} } },
      ],
      defineTool,
    );
    expect(disposers.length).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalled();
    const noexec = seen.find((t) => t.name === "noexec");
    await expect(noexec?.execute?.({})).resolves.toEqual({ ok: false, error: "no execute" });
    expect(noexec?.output?.render(null, "txt")).toEqual([{ type: "text", text: "txt" }]);

    const defineList = (opts: Record<string, unknown>) => ({
      ...opts,
      parameters: { type: "object", properties: {} },
      defined: true,
    });
    const extra = registerListCtxTools(ctx, defineList);
    expect(typeof extra).toBe("function");
    const listCtx = seen.find((t) => t.name === "mini_app_list_ctx_tools");
    expect(listCtx).toMatchObject({
      defined: true,
      parameters: { type: "object", properties: {} },
    });

    const life = new DshLifecycle(ctx, { skillDest: path.join(mkdtempSync(path.join(tmpdir(), "mma-dsh-life-")), "s") });
    life.log("info", "hello");
    life.log("warn", "w");
    life.log("error", "e");
    life.onHostPortChanged(9);
    expect(log).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();

    const throwing: DshCtx = {
      tools: {
        register: () => {
          throw new Error("list fail");
        },
      },
    };
    expect(registerListCtxTools(throwing, defineList)).toBeNull();

    const life2 = new DshLifecycle(
      { tools: { register: () => () => { throw new Error("dispose"); } } },
      { skillDest: "/no/such/src-will-fail-copy" },
    );
    await life2.attach({}, {
      tools: { definitions: () => [{ name: "t", description: "d", inputSchema: { type: "object", properties: {} } }] },
      paths: { root: "/tmp" },
      config: {},
    } as unknown as HostServices);
    await life2.detach();

    warn.mockRestore();
    log.mockRestore();
    err.mockRestore();
  });
});
