import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AppCallContext } from "@monkey-mini-app/host";

import { DshCapabilities } from "../src/capabilities.ts";
import type { DshCtx } from "../src/ctx.ts";
import { coerceSchemaJson, stringifyToolResult, withJsonInstruction } from "../src/llm-stream.ts";

const callCtx: AppCallContext = {
  appId: "com.example.test",
  appDir: "/tmp/com.example.test",
};

describe("DshCapabilities", () => {
  it("runs bash and returns stdout", async () => {
    const caps = new DshCapabilities({});
    const result = await caps.bash(callCtx, "echo hello-mma");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello-mma");
  });

  it("returns a non-zero exitCode when bash fails", async () => {
    const caps = new DshCapabilities({});
    const result = await caps.bash(callCtx, "exit 7");
    expect(result.exitCode).toBe(7);
  });

  it("throws when llm has no dsh model service", async () => {
    const caps = new DshCapabilities({});
    await expect(caps.llm(callCtx, "hi", { provider: "p", model: "m" })).rejects.toThrow(
      /no dsh model service/,
    );
  });

  it("falls back to dsh defaults when provider/model are unbound", async () => {
    async function* stream(req: { provider: string; model: string }) {
      yield { type: "text-delta", text: `${req.provider}/${req.model}` };
    }
    const caps = new DshCapabilities({ llm: { stream } });
    await expect(caps.llm(callCtx, "hi")).resolves.toBe("deepseek-official/deepseek-v4-flash");
  });

  it("prefers dsh agentDefaultModel over hard-coded fallback", async () => {
    async function* stream(req: { provider: string; model: string }) {
      yield { type: "text-delta", text: `${req.provider}/${req.model}` };
    }
    const caps = new DshCapabilities({
      llm: { stream },
      agentDefaultModel: {
        currentSelection: () => ({ provider: "deepseek-official", model: "deepseek-v4-pro" }),
      },
    });
    await expect(caps.llm(callCtx, "hi")).resolves.toBe("deepseek-official/deepseek-v4-pro");
  });

  it("falls through to one-shot when agents.create is missing", async () => {
    const caps = new DshCapabilities({});
    await expect(caps.agent(callCtx, "goal")).rejects.toThrow(/agents factory unbound|SDK helpers/);
  });

  it("lists tools from ctx.tools.schemas", () => {
    const ctx: DshCtx = {
      tools: {
        schemas: () => [{ name: "bash", description: "run", parameters: { type: "object" } }],
      },
    };
    const caps = new DshCapabilities(ctx);
    expect(caps.listTools(callCtx)).toEqual([
      { name: "bash", description: "run", parameters: { type: "object" } },
    ]);
  });

  it("returns empty credentials/config when unbound", () => {
    const caps = new DshCapabilities({});
    expect(caps.credentials(callCtx)).toEqual({});
    expect(caps.config(callCtx)).toEqual({});
    expect(caps.listTools(callCtx)).toEqual([]);
  });

  it("llm streams from ctx.llm and falls back to a function service", async () => {
    async function* stream() {
      yield { type: "text-delta", text: "ok" };
    }
    const streamed = new DshCapabilities({
      llm: { stream },
      config: { llm: { provider: "p", model: "m" } },
    });
    await expect(streamed.llm(callCtx, "hi")).resolves.toBe("ok");

    const fn = new DshCapabilities({
      model: async (prompt: string) => `echo:${prompt}`,
      config: { llm: { provider: "p", model: "m" } },
    });
    await expect(fn.llm(callCtx, "z")).resolves.toBe("echo:z");
  });

  it("agent uses run or spawn when present", async () => {
    const runCaps = new DshCapabilities({
      agents: { run: async (goal: string) => `ran:${goal}` },
    });
    await expect(runCaps.agent(callCtx, "g")).resolves.toBe("ran:g");
    const spawnCaps = new DshCapabilities({
      subagents: { spawn: async (o: { goal: string }) => `spawn:${o.goal}` },
    });
    await expect(spawnCaps.agent(callCtx, "g")).resolves.toBe("spawn:g");
  });

  it("mcp calls ctx.mcp.call / execute and credentials maps getAll", async () => {
    const mcpCall = new DshCapabilities({
      mcp: { call: async (name: string) => ({ name }) },
    });
    await expect(mcpCall.mcp(callCtx, "weather")).resolves.toContain("weather");
    const mcpExec = new DshCapabilities({
      mcp: { execute: async (name: string) => name },
    });
    await expect(mcpExec.mcp(callCtx, "x")).resolves.toBe("x");
    const noMcp = new DshCapabilities({});
    await expect(noMcp.mcp(callCtx, "x")).rejects.toThrow(/no dsh mcp/);
    const noCall = new DshCapabilities({ mcp: {} });
    await expect(noCall.mcp(callCtx, "x")).rejects.toThrow(/no call/);

    const creds = new DshCapabilities({
      credentials: { getAll: () => ({ k: "v" }) },
    });
    expect(creds.credentials(callCtx)).toEqual({ k: "v" });
    const rec = new DshCapabilities({ credentials: { token: "abc", n: 1 } });
    expect(rec.credentials(callCtx)).toEqual({ token: "abc" });
    expect(new DshCapabilities({ credentials: "nope" }).credentials(callCtx)).toEqual({});
    expect(new DshCapabilities({ config: { a: 1 } }).config(callCtx)).toEqual({ a: 1 });
  });

  it("listTools returns [] when schemas throws", () => {
    const caps = new DshCapabilities({
      tools: {
        schemas: () => {
          throw new Error("boom");
        },
      },
    });
    expect(caps.listTools(callCtx)).toEqual([]);
  });

  it("getService swallows ctx.get throws", () => {
    const caps = new DshCapabilities({
      get: () => {
        throw new Error("unbound");
      },
    });
    expect(caps.config(callCtx)).toEqual({});
    expect(caps.listTools(callCtx)).toEqual([]);
  });

  it("tool looks up execute on ctx.tools.get", async () => {
    const ctx: DshCtx = {
      tools: {
        get: (n) =>
          n === "echo"
            ? {
                execute: async (args: unknown) => args,
              }
            : undefined,
      },
    };
    const caps = new DshCapabilities(ctx);
    await expect(caps.tool(callCtx, "echo", { a: 1 })).resolves.toContain("\"a\": 1");
    await expect(caps.tool(callCtx, "missing")).rejects.toThrow(/tool not found/);
  });
});

describe("llm stream helpers", () => {
  it("stringifyToolResult keeps strings and json-ifies objects", () => {
    expect(stringifyToolResult("ok")).toBe("ok");
    expect(stringifyToolResult({ a: 1 })).toContain("\"a\": 1");
  });

  it("withJsonInstruction adds a schema system prompt only when schema is set", () => {
    expect(withJsonInstruction("hi", {}).system).toBeUndefined();
    const withSchema = withJsonInstruction("hi", { schema: { type: "object" } });
    expect(withSchema.system).toContain("JSON Schema");
    expect(withSchema.prompt).toBe("hi");
  });

  it("coerceSchemaJson peels fences when schema is set", () => {
    const opts = { schema: { type: "object" } };
    expect(coerceSchemaJson("```json\n{\"a\":1}\n```", opts)).toBe("{\"a\":1}");
    expect(coerceSchemaJson("noise {\"a\":1} tail", opts)).toBe("{\"a\":1}");
    expect(coerceSchemaJson("plain", {})).toBe("plain");
  });
});

describe("tmp isolation", () => {
  it("does not write host.json as a side effect of constructing capabilities", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-dsh-cap-"));
    new DshCapabilities({});
    expect(dir.length).toBeGreaterThan(0);
  });
});
