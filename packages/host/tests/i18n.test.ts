import { afterEach, describe, expect, it } from "vitest";

import { createHostI18n, HostError, type LocaleId } from "@monkey-mini-app/host";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("createHostI18n", () => {
  it("returns the zh-CN string for config.missingHint", () => {
    const { t } = createHostI18n("zh-CN");
    expect(t("config.missingHint")).toBe("请先运行安装脚本或 mma init 生成 host.json。");
  });

  it("interpolates config.missingFile with the path param", () => {
    const { t } = createHostI18n("zh-CN");
    expect(t("config.missingFile", { path: "/tmp/host.json" })).toBe(
      "未找到 host 配置文件：/tmp/host.json",
    );
  });

  it("returns English strings when locale is en", () => {
    const { t } = createHostI18n("en");
    expect(t("config.missingHint")).toBe(
      "Run the install script or mma init to create host.json.",
    );
    expect(t("config.missingFile", { path: "/tmp/host.json" })).toBe(
      "Host config file not found: /tmp/host.json",
    );
  });

  it("binds t to the locale passed to createHostI18n", () => {
    const zh = createHostI18n("zh-CN");
    const en = createHostI18n("en");
    expect(zh.locale).toBe("zh-CN");
    expect(en.locale).toBe("en");
    expect(zh.t("config.missingHint")).not.toBe(en.t("config.missingHint"));
  });

  it("throws on a missing key in the test environment", () => {
    process.env.NODE_ENV = "test";
    const { t } = createHostI18n("zh-CN");
    expect(() => t("no.such.key")).toThrow(HostError);
    expect(() => t("no.such.key")).toThrow(/missing i18n key: no\.such\.key/);
  });

  it("returns the key id in production when the key is missing", () => {
    process.env.NODE_ENV = "production";
    const { t } = createHostI18n("en");
    expect(t("no.such.key")).toBe("no.such.key");
  });

  it("rejects an unknown locale", () => {
    expect(() => createHostI18n("zh" as LocaleId)).toThrow(HostError);
    expect(() => createHostI18n("zh" as LocaleId)).toThrow(/unsupported locale/);
  });

  it("rejects a key that resolves to a namespace object instead of a string", () => {
    const { t } = createHostI18n("zh-CN");
    // `params` reach i18next as options, so returnObjects leaks the raw object through.
    expect(() => t("config", { returnObjects: "true" })).toThrow(HostError);
    expect(() => t("config", { returnObjects: "true" })).toThrow(
      /i18n key did not resolve to a string: config/,
    );
  });
});
