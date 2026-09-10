import { describe, expect, it } from "vitest";

import { acronymOf, parseManifest } from "@monkey-mini-app/host";

import { HostError } from "../src/errors.ts";

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "com.example.todo",
    name: "待办 Todo",
    version: "1.0.0",
    entry: "ui.tsx",
    ...overrides,
  });
}

describe("parseManifest", () => {
  it("parses a minimal manifest", () => {
    expect(parseManifest(manifestJson())).toEqual({
      id: "com.example.todo",
      name: "待办 Todo",
      version: "1.0.0",
      entry: "ui.tsx",
      description: undefined,
      permissions: [],
      acronym: undefined,
    });
  });

  it("keeps optional fields and filters junk permissions", () => {
    const m = parseManifest(
      manifestJson({
        description: "d",
        acronym: "DB",
        permissions: ["http", 7, null, "bash"],
      }),
    );
    expect(m.description).toBe("d");
    expect(m.acronym).toBe("DB");
    expect(m.permissions).toEqual(["http", "bash"]);
  });

  it("ignores unknown keys instead of failing the app", () => {
    const m = parseManifest(manifestJson({ futureThing: { enabled: true }, note: "x" }));
    expect(m).not.toHaveProperty("futureThing");
    expect(m).not.toHaveProperty("note");
    expect(m.id).toBe("com.example.todo");
  });

  it("rejects invalid JSON, non-objects and bad ids", () => {
    expect(() => parseManifest("{")).toThrow(/not valid JSON/);
    expect(() => parseManifest("null")).toThrow(/must be an object/);
    expect(() => parseManifest("[]")).toThrow(/must be an object/);
    expect(() => parseManifest("")).toThrow(/not valid JSON/);
    expect(() => parseManifest(manifestJson({ id: "Com.Example" }))).toThrow(
      /manifest id is not a valid AppId/,
    );
    expect(() => parseManifest(manifestJson({ id: 42 }))).toThrow(HostError);
    expect(() => parseManifest(manifestJson({ id: undefined }))).toThrow(/manifest id is not a valid AppId/);
  });

  it("requires name, version and entry", () => {
    for (const key of ["name", "version", "entry"]) {
      expect(() => parseManifest(manifestJson({ [key]: "" }))).toThrow(new RegExp(`manifest missing ${key}`));
    }
  });
});

describe("acronymOf", () => {
  it("prefers a valid manifest acronym, else derives from the name", () => {
    expect(acronymOf("Todo", "DB")).toBe("DB");
    expect(acronymOf("Todo", "toolong")).toBe("TO");
    expect(acronymOf("待办 Todo")).toBe("TO");
    expect(acronymOf("", "ab")).toBe("AB");
  });
});
