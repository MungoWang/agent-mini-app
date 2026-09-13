import { describe, expect, it, vi } from "vitest";

import {
  panelLocaleFromDshActive,
  readDshClientLocale,
  resolveClientLocale,
  subscribeDshClientLocale,
} from "../src/client/locale.ts";

describe("panelLocaleFromDshActive", () => {
  it("maps zh / zh* to zh-CN and everything else to en", () => {
    expect(panelLocaleFromDshActive("zh")).toBe("zh-CN");
    expect(panelLocaleFromDshActive("zh-CN")).toBe("zh-CN");
    expect(panelLocaleFromDshActive("en")).toBe("en");
    expect(panelLocaleFromDshActive("en-US")).toBe("en");
    expect(panelLocaleFromDshActive("ja")).toBe("en");
  });

  it("returns null for missing / empty", () => {
    expect(panelLocaleFromDshActive(undefined)).toBeNull();
    expect(panelLocaleFromDshActive(null)).toBeNull();
    expect(panelLocaleFromDshActive("")).toBeNull();
    expect(panelLocaleFromDshActive(1)).toBeNull();
  });
});

describe("readDshClientLocale", () => {
  it("soft-reads ctx.locale.getLocale().active", () => {
    expect(readDshClientLocale({ locale: { getLocale: () => ({ active: "zh" }) } })).toBe("zh-CN");
    expect(readDshClientLocale({ locale: { getLocale: () => ({ active: "en" }) } })).toBe("en");
    expect(
      readDshClientLocale({
        get: (name: string) => (name === "locale" ? { getLocale: () => ({ active: "zh" }) } : undefined),
      }),
    ).toBe("zh-CN");
  });

  it("returns null when the locale service is missing or throws", () => {
    expect(readDshClientLocale(undefined)).toBeNull();
    expect(readDshClientLocale({})).toBeNull();
    expect(
      readDshClientLocale({
        get: () => {
          throw new Error("no inject");
        },
        get locale() {
          throw new Error("undeclared");
        },
      }),
    ).toBeNull();
    expect(
      readDshClientLocale({
        locale: {
          getLocale: () => {
            throw new Error("not ready");
          },
        },
      }),
    ).toBeNull();
  });
});

describe("resolveClientLocale", () => {
  it("prefers dsh locale over the browser", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "en-US", languages: ["en-US"] },
    });
    expect(resolveClientLocale({ locale: { getLocale: () => ({ active: "zh" }) } })).toBe("zh-CN");
  });
});

describe("subscribeDshClientLocale", () => {
  it("follows ctx.on('locale/change')", () => {
    const listeners: Array<(snap: unknown) => void> = [];
    const off = vi.fn();
    const ctx = {
      on: (event: string, fn: (snap: unknown) => void) => {
        expect(event).toBe("locale/change");
        listeners.push(fn);
        return off;
      },
    };
    const seen: string[] = [];
    const stop = subscribeDshClientLocale(ctx, (locale) => {
      seen.push(locale);
    });
    listeners[0]?.({ active: "en" });
    listeners[0]?.({ active: "zh" });
    stop();
    expect(seen).toEqual(["en", "zh-CN"]);
    expect(off).toHaveBeenCalled();
  });

  it("falls back to ctx.locale.subscribe when on() is missing", () => {
    let notify: (() => void) | undefined;
    const off = vi.fn();
    let active = "zh";
    const ctx = {
      locale: {
        getLocale: () => ({ active }),
        subscribe: (fn: () => void) => {
          notify = fn;
          return off;
        },
      },
    };
    const seen: string[] = [];
    const stop = subscribeDshClientLocale(ctx, (locale) => {
      seen.push(locale);
    });
    active = "en";
    notify?.();
    stop();
    expect(seen).toEqual(["en"]);
    expect(off).toHaveBeenCalled();
  });

  it("returns a no-op disposer when nothing is available", () => {
    expect(() => subscribeDshClientLocale({}, () => undefined)()).not.toThrow();
    expect(() => subscribeDshClientLocale(undefined, () => undefined)()).not.toThrow();
  });
});
