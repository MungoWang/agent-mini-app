import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultDshSettingsPath,
  detectDshOrSystemLocale,
  detectSystemLocale,
  localeFromDshPreference,
  localeFromLanguageTag,
  parseDshLocalePreference,
  readDshLocalePreference,
} from "@monkey-mini-app/host";

describe("localeFromLanguageTag", () => {
  it("maps zh* tags to zh-CN", () => {
    expect(localeFromLanguageTag("zh")).toBe("zh-CN");
    expect(localeFromLanguageTag("zh-CN")).toBe("zh-CN");
    expect(localeFromLanguageTag("zh-Hans")).toBe("zh-CN");
    expect(localeFromLanguageTag("zh_TW")).toBe("zh-CN");
    expect(localeFromLanguageTag("ZH-cn")).toBe("zh-CN");
    expect(localeFromLanguageTag("zh_CN.UTF-8")).toBe("zh-CN");
  });

  it("maps non-zh tags to en", () => {
    expect(localeFromLanguageTag("en")).toBe("en");
    expect(localeFromLanguageTag("en-US")).toBe("en");
    expect(localeFromLanguageTag("ja-JP")).toBe("en");
    expect(localeFromLanguageTag("fr_FR.UTF-8")).toBe("en");
    expect(localeFromLanguageTag("")).toBe("en");
    expect(localeFromLanguageTag(undefined)).toBe("en");
    expect(localeFromLanguageTag(null)).toBe("en");
    expect(localeFromLanguageTag("C")).toBe("en");
    expect(localeFromLanguageTag("POSIX")).toBe("en");
  });
});

describe("detectSystemLocale", () => {
  it("prefers Intl over env", () => {
    expect(
      detectSystemLocale({
        intlLocale: "zh-Hans-CN",
        env: { LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh-CN");
    expect(
      detectSystemLocale({
        intlLocale: "en-US",
        env: { LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });

  it("falls back through LC_ALL / LC_MESSAGES / LANG when Intl is skipped", () => {
    expect(
      detectSystemLocale({
        intlLocale: null,
        env: { LC_ALL: "C", LC_MESSAGES: "zh_TW.UTF-8", LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh-CN");
    expect(
      detectSystemLocale({
        intlLocale: null,
        env: { LANG: "en_GB.UTF-8" },
      }),
    ).toBe("en");
  });

  it("returns en when nothing useful is available", () => {
    expect(detectSystemLocale({ intlLocale: null, env: { LC_ALL: "C", LANG: "POSIX" } })).toBe(
      "en",
    );
    expect(detectSystemLocale({ intlLocale: null, env: {} })).toBe("en");
  });
});

describe("localeFromDshPreference", () => {
  it("maps zh / zh* to zh-CN and everything else to en", () => {
    expect(localeFromDshPreference("zh")).toBe("zh-CN");
    expect(localeFromDshPreference("zh-CN")).toBe("zh-CN");
    expect(localeFromDshPreference("zh-Hans")).toBe("zh-CN");
    expect(localeFromDshPreference("en")).toBe("en");
    expect(localeFromDshPreference("en-US")).toBe("en");
    expect(localeFromDshPreference("ja")).toBe("en");
    expect(localeFromDshPreference("  'zh'  ")).toBe("zh-CN");
  });

  it("returns null for empty / missing so callers can fall back", () => {
    expect(localeFromDshPreference(undefined)).toBeNull();
    expect(localeFromDshPreference(null)).toBeNull();
    expect(localeFromDshPreference("")).toBeNull();
    expect(localeFromDshPreference("   ")).toBeNull();
    expect(localeFromDshPreference('""')).toBeNull();
  });
});

describe("parseDshLocalePreference", () => {
  it("reads an indented YAML locale.preference", () => {
    expect(parseDshLocalePreference("locale:\n  preference: zh\n")).toBe("zh");
    expect(parseDshLocalePreference("locale:\n  preference: en\n")).toBe("en");
    expect(parseDshLocalePreference("locale:\n  preference: \"zh-CN\"\n")).toBe("zh-CN");
    expect(parseDshLocalePreference("locale:\n  preference: 'en'\n")).toBe("en");
  });

  it("reads an inline YAML map and JSON", () => {
    expect(parseDshLocalePreference("locale: { preference: zh }\n")).toBe("zh");
    expect(parseDshLocalePreference('{"locale":{"preference":"en"}}')).toBe("en");
  });

  it("ignores comments, blank lines, and sibling keys", () => {
    const text = [
      "# harness settings",
      "theme:",
      "  mode: dark",
      "locale:",
      "  # language",
      "  other: 1",
      "  preference: zh # comment",
      "plugins:",
      "  foo: true",
      "",
    ].join("\n");
    expect(parseDshLocalePreference(text)).toBe("zh");
  });

  it("does not pick a nested locale under another top-level key", () => {
    expect(parseDshLocalePreference("plugins:\n  locale:\n    preference: zh\n")).toBeUndefined();
  });

  it("returns undefined when preference is missing or blank", () => {
    expect(parseDshLocalePreference("")).toBeUndefined();
    expect(parseDshLocalePreference("theme:\n  mode: dark\n")).toBeUndefined();
    expect(parseDshLocalePreference("locale:\n  preference: \n")).toBeUndefined();
    expect(parseDshLocalePreference("{not json")).toBeUndefined();
  });
});

describe("readDshLocalePreference / detectDshOrSystemLocale", () => {
  it("reads a settings.yaml path and prefers it over OS detect", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-dsh-locale-"));
    const file = path.join(dir, "settings.yaml");
    writeFileSync(file, "locale:\n  preference: zh\n");
    expect(readDshLocalePreference(file)).toBe("zh");
    expect(
      detectDshOrSystemLocale({
        settingsPath: file,
        intlLocale: "en-US",
        env: { LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh-CN");
  });

  it("falls back to OS detect when the file is missing or settingsPath is null", () => {
    expect(readDshLocalePreference(path.join(tmpdir(), "mma-no-such-settings.yaml"))).toBeUndefined();
    expect(
      detectDshOrSystemLocale({
        settingsPath: path.join(tmpdir(), "mma-no-such-settings.yaml"),
        intlLocale: "en-US",
      }),
    ).toBe("en");
    expect(
      detectDshOrSystemLocale({
        settingsPath: null,
        intlLocale: "zh-Hans-CN",
        env: { LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh-CN");
  });

  it("exposes a default settings path under DSH_HOME or ~/.dsh", () => {
    const resolved = defaultDshSettingsPath();
    expect(resolved.endsWith("settings.yaml")).toBe(true);
    expect(resolved.includes(".dsh") || resolved.includes("dsh")).toBe(true);
  });
});
