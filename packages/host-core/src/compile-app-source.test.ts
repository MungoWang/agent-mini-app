import { describe, expect, it } from "vitest";
import { compileAppSource, jsonClone } from "./compile-app-source.js";

function loadCompiled(src: string) {
  const compiled = compileAppSource(src);
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const fn = new Function(
    "module",
    "exports",
    "require",
    compiled + "\nreturn module.exports;"
  );
  return fn(mod, mod.exports, () => ({}));
}

describe("compileAppSource", () => {
  it("puts export function onto module.exports (news/intel parseFeed)", () => {
    const exp = loadCompiled(`
      export function parseFeed(xml) {
        return [{ title: String(xml).slice(0, 4) }];
      }
    `);
    expect(typeof exp.parseFeed).toBe("function");
    expect(exp.parseFeed("HackerNews")).toEqual([{ title: "Hack" }]);
  });

  it("compiles real TypeScript (params, object return types, catch e: any)", () => {
    const exp = loadCompiled(`
      export function parseFeed(xml: string): { title: string; url: string }[] {
        const items: { title: string; url: string }[] = [];
        try {
          items.push({ title: xml.slice(0, 4), url: "u" });
        } catch (e: any) {
          return [{ title: String(e && e.message), url: "" }];
        }
        return items;
      }
    `);
    expect(exp.parseFeed("HackerNews")).toEqual([{ title: "Hack", url: "u" }]);
  });

  it("puts export const and export async function onto module.exports", () => {
    const exp = loadCompiled(`
      export const UA = "mma";
      export async function fetchAll(ctx: string) { return UA + ":" + ctx; }
    `);
    expect(exp.UA).toBe("mma");
    expect(typeof exp.fetchAll).toBe("function");
  });

  it("keeps export { named } working", () => {
    const exp = loadCompiled(`
      function inner() { return 7; }
      export { inner as parseFeed };
    `);
    expect(exp.parseFeed()).toBe(7);
  });

  it("still compiles export default defineDashboard", () => {
    const exp = loadCompiled(`
      function defineDashboard(d) { return d; }
      export default defineDashboard({ name: "X", api: {} });
    `);
    expect(exp.default.name).toBe("X");
  });

  it("does not wreck object literals or non-capturing regex", () => {
    const exp = loadCompiled(`
      export function parse(s: string) {
        const re = /(?:title|link)=([^;]+)/;
        const m = re.exec(s);
        return { key: m ? m[1] : "", ok: true };
      }
    `);
    expect(exp.parse("title=hi")).toEqual({ key: "hi", ok: true });
  });
});

describe("jsonClone", () => {
  it("turns Date into an ISO string so dsh lossless-JSON snapshot can accept it", () => {
    const d = new Date("2026-08-23T00:00:00.000Z");
    const cloned = jsonClone({ at: d, n: 1 }, { at: "", n: 0 });
    expect(cloned.at).toBe("2026-08-23T00:00:00.000Z");
    expect(cloned.n).toBe(1);
  });
});
