import { describe, expect, it, vi } from "vitest";

import type { AppCallContext } from "../src/app-runtime.ts";
import { bindCapsToContext, type HostCapabilities } from "../src/capabilities.ts";

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
    expect(agent).toHaveBeenCalledWith(callCtx, "hi", undefined);

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
});
