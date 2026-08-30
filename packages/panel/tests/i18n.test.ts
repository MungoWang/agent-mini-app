import { afterEach, describe, expect, it } from "vitest";

import { createPanelI18n, type LocaleId,PanelError, resolvePanelLocale } from "@monkey-mini-app/panel";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("createPanelI18n", () => {
  it("returns zh-CN chrome strings", () => {
    const { t, locale } = createPanelI18n("zh-CN");
    expect(locale).toBe("zh-CN");
    expect(t("list.empty")).toBe("还没有小程序。");
    expect(t("tabs.all")).toBe("全部");
    expect(t("list.noMatch", { query: "abc" })).toBe("没有匹配「abc」的小程序。");
  });

  it("returns English chrome strings", () => {
    const { t } = createPanelI18n("en");
    expect(t("list.empty")).toBe("No mini apps yet.");
    expect(t("tabs.all")).toBe("All");
    expect(t("list.noMatch", { query: "abc" })).toBe('No mini apps matching "abc".');
    expect(t("config.saved")).toBe("Saved");
  });

  it("throws on a missing key outside production", () => {
    process.env.NODE_ENV = "test";
    const { t } = createPanelI18n("en");
    expect(() => t("no.such.key")).toThrow(PanelError);
    expect(() => t("no.such.key")).toThrow(/missing i18n key: no\.such\.key/);
  });

  it("returns the key id in production when missing", () => {
    process.env.NODE_ENV = "production";
    const { t } = createPanelI18n("en");
    expect(t("no.such.key")).toBe("no.such.key");
  });

  it("rejects an unknown locale", () => {
    expect(() => createPanelI18n("zh" as LocaleId)).toThrow(PanelError);
    expect(() => createPanelI18n("zh" as LocaleId)).toThrow(/unsupported locale/);
    expect(() => resolvePanelLocale("zh")).toThrow(PanelError);
  });

  it("resolvePanelLocale defaults to zh-CN", () => {
    expect(resolvePanelLocale(undefined)).toBe("zh-CN");
    expect(resolvePanelLocale("en")).toBe("en");
  });
});
