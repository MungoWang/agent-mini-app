import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppsManager,
  GitHistory,
  Host,
  HostConfigError,
  HostError,
  HttpGateway,
  ToolFacade,
  WorkspacePaths,
  bootstrapHostConfig,
  createHost,
  type HostCapabilities,
  type HostConfig,
  type HostLifecycle,
  type HostServices,
} from "@monkey-mini-app/host";

function validConfig(hostPort = 0): HostConfig {
  const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
  return bootstrapHostConfig({ runtimeRoot: dir, hostPort });
}

function fakeCapabilities(): HostCapabilities {
  return {
    bash: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    listTools: () => [],
  };
}

function fakeLifecycle(overrides: Partial<HostLifecycle> = {}): HostLifecycle {
  return {
    attach: () => undefined,
    ...overrides,
  };
}

let host: Host | undefined;

afterEach(async () => {
  if (host) {
    await host.stop();
    host = undefined;
  }
});

describe("createHost", () => {
  it("throws if config is invalid", () => {
    const lifecycle = fakeLifecycle();
    const capabilities = fakeCapabilities();
    expect(() =>
      createHost(capabilities, lifecycle, { config: { hostPort: 0 } as HostConfig }),
    ).toThrow(HostConfigError);
    expect(() =>
      createHost(capabilities, lifecycle, {
        config: {
          runtimeRoot: "relative",
          hostPort: 0,
          theme: "light",
          palette: "default",
          locale: "zh-CN",
          chatLanguage: "zh-CN",
          llm: null,
        } as HostConfig,
      }),
    ).toThrow(HostConfigError);
  });

  it("returns a Host for an already-parsed config", () => {
    host = createHost(fakeCapabilities(), fakeLifecycle(), { config: validConfig() });
    expect(host).toBeInstanceOf(Host);
    expect(host.port).toBe(0);
  });
});

describe("Host.apply", () => {
  it("calls lifecycle.attach with ctx and real HostServices", async () => {
    const attach = vi.fn();
    const lifecycle = fakeLifecycle({ attach });
    host = createHost(fakeCapabilities(), lifecycle, { config: validConfig() });
    const ctx = { plugin: "dsh" };
    await host.apply(ctx);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach.mock.calls[0]?.[0]).toBe(ctx);
    const services = attach.mock.calls[0]?.[1];
    expect(services?.apps).toBeInstanceOf(AppsManager);
    expect(services?.git).toBeInstanceOf(GitHistory);
    expect(services?.tools).toBeInstanceOf(ToolFacade);
    expect(services?.paths).toBeInstanceOf(WorkspacePaths);
    expect(services?.config.hostPort).toBe(0);
  });

  it("attaches then listens (apply = attach + start)", async () => {
    const order: string[] = [];
    const lifecycle = fakeLifecycle({
      attach: () => {
        order.push("attach");
      },
      onHostPortChanged: (port) => {
        order.push(`listen:${port}`);
      },
    });
    host = createHost(fakeCapabilities(), lifecycle, { config: validConfig() });
    const { port } = await host.apply();
    expect(port).toBeGreaterThan(0);
    expect(host.port).toBe(port);
    expect(order).toEqual(["attach", `listen:${port}`]);
  });
});

describe("Host.start / stop", () => {
  it("binds an ephemeral port when hostPort is 0", async () => {
    host = createHost(fakeCapabilities(), fakeLifecycle(), { config: validConfig(0) });
    const { port } = await host.start();
    expect(port).toBeGreaterThan(0);
    expect(host.port).toBe(port);
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, hostPort: port });
  });

  it("is idempotent on start and stop; stop calls detach and closes the server", async () => {
    const detach = vi.fn();
    const lifecycle = fakeLifecycle({ detach });
    host = createHost(fakeCapabilities(), lifecycle, { config: validConfig() });
    const first = await host.apply();
    const second = await host.start();
    expect(second.port).toBe(first.port);
    await host.stop();
    expect(detach).toHaveBeenCalledTimes(1);
    await host.stop();
    expect(detach).toHaveBeenCalledTimes(1);
    expect(host.port).toBe(0);
    await expect(fetch(`http://127.0.0.1:${first.port}/`)).rejects.toThrow();
  });

  it("calls detach if present even when start ran without apply", async () => {
    const detach = vi.fn();
    host = createHost(fakeCapabilities(), fakeLifecycle({ detach }), { config: validConfig() });
    await host.start();
    await host.stop();
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it("rethrows HostError from listen and wraps other listen failures", async () => {
    const config = validConfig();
    const paths = new WorkspacePaths(config.runtimeRoot);
    const services = { paths, config } as unknown as HostServices;
    const hostError = new HostError("HOST_LISTEN_FAILED", "already HostError");
    const failingHostError = {
      listen: async () => {
        throw hostError;
      },
      close: async () => undefined,
    } as unknown as HttpGateway;
    const a = new Host(fakeCapabilities(), fakeLifecycle(), paths, config, services, failingHostError);
    await expect(a.start()).rejects.toBe(hostError);

    const failingGeneric = {
      listen: async () => {
        throw new Error("eaddrinuse");
      },
      close: async () => undefined,
    } as unknown as HttpGateway;
    const b = new Host(fakeCapabilities(), fakeLifecycle(), paths, config, services, failingGeneric);
    await expect(b.start()).rejects.toThrow(HostError);
    await expect(b.start()).rejects.toThrow(/failed to listen/);
  });
});
