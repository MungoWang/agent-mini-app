import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Host from "@monkey-mini-app/host";

vi.mock("@monkey-mini-app/host", async () => {
  const actual = await vi.importActual<typeof Host>("@monkey-mini-app/host");
  return {
    ...actual,
    createHost: vi.fn(),
    loadHostConfig: vi.fn(() => ({
      runtimeRoot: "/tmp/mma-test-runtime",
      hostPort: 17880,
      theme: "light",
      palette: "default",
      locale: "zh-CN",
      chatLanguage: "zh-CN",
      llm: null,
    })),
  };
});

import { createHost } from "@monkey-mini-app/host";

import { apply } from "../src/index.ts";

const createHostMock = createHost as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  createHostMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dsh plugin apply", () => {
  it("starts the host and returns a dispose that stops it", async () => {
    const stop = vi.fn(() => Promise.resolve());
    createHostMock.mockReturnValue({ apply: async () => ({ port: 17880 }), stop });
    const dispose = await apply({} as never, {});
    expect(createHostMock).toHaveBeenCalled();
    expect(typeof dispose).toBe("function");
    dispose();
    expect(stop).toHaveBeenCalled();
  });

  it("degrades (returns a no-op dispose) instead of throwing when the host cannot bind", async () => {
    const stop = vi.fn(() => Promise.resolve());
    createHostMock.mockReturnValue({
      apply: async () => {
        throw new Error("failed to listen on 17880");
      },
      stop,
    });
    const dispose = await apply({} as never, {});
    expect(typeof dispose).toBe("function");
    dispose();
    expect(console.error).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
