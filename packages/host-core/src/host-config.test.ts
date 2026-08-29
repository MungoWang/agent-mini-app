import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clampPort,
  publicAppConfig,
  readHostConfig,
  writeHostConfig,
} from "./host-config.js";

describe("host-config", () => {
  it("rejects ports outside 1024–65535", () => {
    expect(() => clampPort(80)).toThrow(/1024/);
    expect(() => clampPort(17880)).not.toThrow();
  });

  it("reads defaults and writes host.json + llm.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "mma-host-"));
    const a = readHostConfig(dir);
    expect(a.hostPort).toBe(17880);
    expect(a.llm.provider).toBe("deepseek-official");
    const b = writeHostConfig(dir, {
      hostPort: 19001,
      theme: "dark",
      palette: "tokyo",
      chatLanguage: "en",
      llm: { provider: "deepseek-official", model: "deepseek-v4-flash" },
    });
    expect(b.hostPort).toBe(19001);
    expect(b.palette).toBe("tokyo");
    const c = readHostConfig(dir);
    expect(c).toEqual(b);
    expect(publicAppConfig(c, 19001)).toEqual({
      theme: "dark",
      palette: "tokyo",
      chatLanguage: "en",
      hostPort: 19001,
      llm: { provider: "deepseek-official", model: "deepseek-v4-flash" },
    });
  });

  it("migrates legacy palette ids on read", () => {
    const dir = mkdtempSync(join(tmpdir(), "mma-host-"));
    writeFileSync(join(dir, "host.json"), JSON.stringify({ theme: "light", palette: "mist" }));
    expect(readHostConfig(dir).palette).toBe("tokyo");
  });

  it("still honors legacy llm.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "mma-host-"));
    writeFileSync(
      join(dir, "llm.json"),
      JSON.stringify({ provider: "p", model: "m" })
    );
    const c = readHostConfig(dir);
    expect(c.llm).toEqual({ provider: "p", model: "m" });
  });
});
