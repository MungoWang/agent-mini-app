import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  asAbsolutePath,
  bootstrapHostConfig,
  DEFAULT_HOST_CONFIG_SEED,
  HostConfigError,
  loadHostConfig,
  parseHostConfig,
  WorkspacePaths,
} from "@monkey-mini-app/host";

const hostSrcDir = fileURLToPath(new URL("../src/", import.meta.url));

function validConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    runtimeRoot: "/tmp/mma-runtime",
    hostPort: 17880,
    theme: "light",
    palette: "default",
    locale: "zh-CN",
    chatLanguage: "zh-CN",
    llm: null,
    ...overrides,
  };
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("parseHostConfig", () => {
  it("rejects missing runtimeRoot", () => {
    const { runtimeRoot: _, ...rest } = validConfig();
    expect(() => parseHostConfig(rest)).toThrow(HostConfigError);
    expect(() => parseHostConfig(rest)).toThrow(/runtimeRoot/);
  });

  it("rejects non-object input", () => {
    expect(() => parseHostConfig(null)).toThrow(HostConfigError);
    expect(() => parseHostConfig("nope")).toThrow(HostConfigError);
    expect(() => parseHostConfig([])).toThrow(HostConfigError);
  });

  it("rejects a relative runtimeRoot", () => {
    expect(() => parseHostConfig(validConfig({ runtimeRoot: "runtime" }))).toThrow(
      HostConfigError,
    );
  });

  it("rejects missing theme rather than defaulting", () => {
    const { theme: _, ...rest } = validConfig();
    expect(() => parseHostConfig(rest)).toThrow(HostConfigError);
    expect(() => parseHostConfig(rest)).toThrow(/theme/);
  });

  it("rejects invalid hostPort, theme, palette, locale, and llm", () => {
    expect(() => parseHostConfig(validConfig({ hostPort: 80.5 }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ hostPort: "17880" }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ theme: "dim" }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ palette: "" }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ palette: "   " }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ locale: "zh" }))).toThrow(HostConfigError);
    expect(() => parseHostConfig(validConfig({ chatLanguage: "en-US" }))).toThrow(
      HostConfigError,
    );
    expect(() => parseHostConfig(validConfig({ llm: { provider: "p" } }))).toThrow(
      HostConfigError,
    );
  });

  it("accepts a complete config including llm null and hostPort 0", () => {
    const parsed = parseHostConfig(
      validConfig({
        hostPort: 0,
        theme: "dark",
        palette: "tokyo",
        locale: "en",
        chatLanguage: "en",
        llm: null,
      }),
    );
    expect(parsed.hostPort).toBe(0);
    expect(parsed.theme).toBe("dark");
    expect(parsed.palette).toBe("tokyo");
    expect(parsed.locale).toBe("en");
    expect(parsed.chatLanguage).toBe("en");
    expect(parsed.llm).toBeNull();
    expect(parsed.runtimeRoot).toBe("/tmp/mma-runtime");
  });

  it("accepts custom palette ids (theme CSS files)", () => {
    const parsed = parseHostConfig(validConfig({ palette: "crimson" }));
    expect(parsed.palette).toBe("crimson");
  });

  it("accepts an explicit llm object", () => {
    const parsed = parseHostConfig(
      validConfig({ llm: { provider: "deepseek-official", model: "deepseek-v4-flash" } }),
    );
    expect(parsed.llm).toEqual({ provider: "deepseek-official", model: "deepseek-v4-flash" });
  });

  it("rejects a non-string runtimeRoot", () => {
    expect(() => parseHostConfig(validConfig({ runtimeRoot: 42 }))).toThrow(
      /runtimeRoot is invalid/,
    );
    expect(() => parseHostConfig(validConfig({ runtimeRoot: {} }))).toThrow(HostConfigError);
  });

  it("rejects junk llm shapes rather than guessing", () => {
    expect(() => parseHostConfig(validConfig({ llm: "deepseek" }))).toThrow(/llm is invalid/);
    expect(() => parseHostConfig(validConfig({ llm: ["p", "m"] }))).toThrow(/llm is invalid/);
    expect(() => parseHostConfig(validConfig({ llm: { provider: "", model: "m" } }))).toThrow(
      /llm\.provider is invalid/,
    );
    expect(() => parseHostConfig(validConfig({ llm: { provider: 7, model: "m" } }))).toThrow(
      /llm\.provider is invalid/,
    );
    expect(() => parseHostConfig(validConfig({ llm: { provider: "p", model: "" } }))).toThrow(
      /llm\.model is invalid/,
    );
  });

  it("does not treat the seed as a valid runtime config", () => {
    expect(() => parseHostConfig(DEFAULT_HOST_CONFIG_SEED)).toThrow(HostConfigError);
  });
});

describe("bootstrapHostConfig", () => {
  it("fills theme and locale from the seed", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const cfg = bootstrapHostConfig({ runtimeRoot: dir });
    expect(cfg.theme).toBe(DEFAULT_HOST_CONFIG_SEED.theme);
    expect(cfg.locale).toBe(DEFAULT_HOST_CONFIG_SEED.locale);
    expect(cfg.chatLanguage).toBe(DEFAULT_HOST_CONFIG_SEED.chatLanguage);
    expect(cfg.palette).toBe(DEFAULT_HOST_CONFIG_SEED.palette);
    expect(cfg.hostPort).toBe(DEFAULT_HOST_CONFIG_SEED.hostPort);
    expect(cfg.llm).toBe(DEFAULT_HOST_CONFIG_SEED.llm);
    expect(cfg.runtimeRoot).toBe(path.resolve(dir));
  });

  it("lets input override seeded fields", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const cfg = bootstrapHostConfig({
      runtimeRoot: dir,
      theme: "dark",
      locale: "en",
      hostPort: 0,
      llm: { provider: "p", model: "m" },
    });
    expect(cfg.theme).toBe("dark");
    expect(cfg.locale).toBe("en");
    expect(cfg.hostPort).toBe(0);
    expect(cfg.llm).toEqual({ provider: "p", model: "m" });
  });

  it("expands a seeded home runtimeRoot to an absolute path", () => {
    const cfg = bootstrapHostConfig({});
    expect(path.isAbsolute(cfg.runtimeRoot)).toBe(true);
    expect(cfg.runtimeRoot.includes(".monkey-mini-app")).toBe(true);
  });

  it("expands a bare ~ and ~/subdir against the real home directory", () => {
    expect(bootstrapHostConfig({ runtimeRoot: "~" }).runtimeRoot).toBe(homedir());
    expect(bootstrapHostConfig({ runtimeRoot: "~/mma-runtime" }).runtimeRoot).toBe(
      path.join(homedir(), "mma-runtime"),
    );
    expect(bootstrapHostConfig({ runtimeRoot: "~\\mma-runtime" }).runtimeRoot).toBe(
      path.join(homedir(), "mma-runtime"),
    );
  });

  it("ignores seeded keys whose input override is explicitly undefined", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const cfg = bootstrapHostConfig({ runtimeRoot: dir, theme: undefined, hostPort: undefined });
    expect(cfg.theme).toBe(DEFAULT_HOST_CONFIG_SEED.theme);
    expect(cfg.hostPort).toBe(DEFAULT_HOST_CONFIG_SEED.hostPort);
  });
});

describe("loadHostConfig", () => {
  it("reads host.json via WorkspacePaths and does not apply defaults", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const paths = new WorkspacePaths(asAbsolutePath(dir));
    const raw = validConfig({
      runtimeRoot: dir,
      hostPort: 19001,
      theme: "dark",
      palette: "tokyo",
      locale: "en",
      chatLanguage: "en",
      llm: null,
    });
    writeFileSync(paths.hostConfigFile(), JSON.stringify(raw));
    expect(loadHostConfig(paths)).toEqual(raw);
  });

  it("throws when host.json is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const paths = new WorkspacePaths(asAbsolutePath(dir));
    expect(() => loadHostConfig(paths)).toThrow(HostConfigError);
  });

  it("throws on a partial file instead of filling seed values", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const paths = new WorkspacePaths(asAbsolutePath(dir));
    const { theme: _, ...rest } = validConfig({ runtimeRoot: dir });
    writeFileSync(paths.hostConfigFile(), JSON.stringify(rest));
    expect(() => loadHostConfig(paths)).toThrow(HostConfigError);
    expect(() => loadHostConfig(paths)).toThrow(/theme/);
  });

  it("throws on invalid JSON", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-host-"));
    const paths = new WorkspacePaths(asAbsolutePath(dir));
    writeFileSync(paths.hostConfigFile(), "{");
    expect(() => loadHostConfig(paths)).toThrow(HostConfigError);
  });
});

describe("DEFAULT_HOST_CONFIG_SEED", () => {
  it("is the only host/src module that contains the .monkey-mini-app string", () => {
    expect(DEFAULT_HOST_CONFIG_SEED.runtimeRoot.includes(".monkey-mini-app")).toBe(true);
    const hits = listTsFiles(hostSrcDir)
      .filter((file) => readFileSync(file, "utf8").includes(".monkey-mini-app"))
      .map((file) => path.relative(hostSrcDir, file));
    expect(hits).toEqual(["config/defaults.ts"]);
  });
});
