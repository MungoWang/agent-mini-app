import { describe, expect, it } from "vitest";

import { HostError } from "@monkey-mini-app/host";

import { compileAppSource } from "../src/apps/compile-app-source.ts";

describe("compileAppSource", () => {
  it("strips a BOM and compiles TypeScript to CJS", () => {
    const out = compileAppSource("\uFEFFexport const n: number = 1;\n");
    expect(out).toMatch(/exports/);
    expect(out).toContain("n");
  });

  it("wraps sucrase failures in HostError", () => {
    expect(() => compileAppSource("const x = {")).toThrow(HostError);
    expect(() => compileAppSource("const x = {")).toThrow(/compileAppSource/);
  });
});
