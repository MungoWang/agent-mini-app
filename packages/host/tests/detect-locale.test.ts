import { describe, expect, it } from "vitest";

import { detectSystemLocale, localeFromLanguageTag } from "@monkey-mini-app/host";

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
