import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  bootstrapHostConfig,
  createHost,
  type HostCapabilities,
  type HostServices,
} from "@monkey-mini-app/host";

/**
 * A **class**, on purpose — that is the shape every real adapter has (dsh ships
 * `DshCapabilities`). Its capability methods live on the prototype, so any code that
 * rebuilds the capabilities object with `{ ...capabilities }` silently produces an object
 * with no methods at all, and every `ctx.*` call dies with
 * `CAPABILITY_UNAVAILABLE: … host capability not available`.
 *
 * This regressed once (create-host binding ctx.push) and the object-literal caps used by
 * tests/react-host could not see it. Keep this file class-shaped.
 */
class PrototypeCaps implements HostCapabilities {
  bash(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return Promise.resolve({ stdout: "bash-ran", stderr: "", exitCode: 0 });
  }

  llm(): Promise<string> {
    return Promise.resolve("llm-ran");
  }

  agent(): Promise<string> {
    return Promise.resolve("agent-ran");
  }

  tool(): Promise<string> {
    return Promise.resolve("tool-ran");
  }

  mcp(): Promise<string> {
    return Promise.resolve("mcp-ran");
  }

  listTools(): unknown[] {
    return [{ name: "read" }];
  }

  credentials(): Record<string, string> {
    return { SECRET: "cred-ran" };
  }

  config(): Record<string, unknown> {
    return { theme: "dark" };
  }
}

const PROBE_API = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "Probe",
  description: "reaches every host capability",
  api: {
    async ping(ctx) {
      ctx.push("probe", { seen: true });
      return {
        bash: (await ctx.bash("true")).stdout,
        llm: await ctx.llm("x"),
        agent: await ctx.agent("go"),
        tool: await ctx.tool("read", {}),
        mcp: await ctx.mcp("everything__echo", { message: "hi" }),
        tools: ctx.listTools().length,
        cred: ctx.credentials.SECRET,
        cfg: ctx.config.theme,
      };
    },
  },
});
`;

async function bootWith(caps: HostCapabilities): Promise<{ services: HostServices; stop(): Promise<void> }> {
  const root = mkdtempSync(path.join(tmpdir(), "mma-caps-"));
  let services: HostServices | undefined;
  const host = createHost(caps, { attach: (_c, s) => { services = s; } }, {
    config: bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 }),
  });
  await host.apply();
  if (!services) throw new Error("attach did not provide services");
  const apps = services.apps;
  await apps.register("com.example.probe", {
    "manifest.json": JSON.stringify({
      id: "com.example.probe",
      name: "Probe",
      version: "0.1.0",
      entry: "ui.tsx",
    }),
    "ui.tsx": "export default function Ui() { return null; }\n",
    "main.api.ts": PROBE_API,
  });
  return { services, stop: () => host.stop() };
}

describe("host capabilities wiring (class-shaped adapter)", () => {
  it("every ctx.* capability survives createHost", async () => {
    const { services, stop } = await bootWith(new PrototypeCaps());
    try {
      const out = (await services.apps.call("com.example.probe", "ping", {})) as Record<string, unknown>;
      // Not "host capability not available" — the adapter was consulted for each one.
      expect(out).toEqual({
        bash: "bash-ran",
        llm: "llm-ran",
        agent: "agent-ran",
        tool: "tool-ran",
        mcp: "mcp-ran",
        tools: 1,
        cred: "cred-ran",
        cfg: "dark",
      });
    } finally {
      await stop();
    }
  });

  it("still lets the host own ctx.push (bound to the event bus, not the adapter)", async () => {
    const { services, stop } = await bootWith(new PrototypeCaps());
    try {
      // PrototypeCaps deliberately does NOT implement push — createHost injects it, so the
      // wrapper must add it without erasing the inherited capabilities above.
      const events: { type: string; appId?: string; name?: string }[] = [];
      const off = services.events.subscribe((e) => events.push(e as never));
      await expect(services.apps.call("com.example.probe", "ping", {})).resolves.toBeTruthy();
      off();
      const pushed = events.filter((e) => e.type === "app:event" && e.name === "probe");
      expect(pushed.length).toBe(1);
      expect(pushed[0]?.appId).toBe("com.example.probe");
    } finally {
      await stop();
    }
  });

  it("an object-literal adapter keeps working too (react-host / tests)", async () => {
    const { services, stop } = await bootWith({
      bash: async () => ({ stdout: "literal-bash", stderr: "", exitCode: 0 }),
      llm: async () => "literal-llm",
      agent: async () => "literal-agent",
      tool: async () => "literal-tool",
      mcp: async () => "literal-mcp",
      listTools: () => [],
      credentials: () => ({}),
      config: () => ({}),
    });
    try {
      const out = (await services.apps.call("com.example.probe", "ping", {})) as Record<string, unknown>;
      expect(out.llm).toBe("literal-llm");
      expect(out.bash).toBe("literal-bash");
    } finally {
      await stop();
    }
  });
});
