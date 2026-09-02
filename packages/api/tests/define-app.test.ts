import { describe, expect, it } from "vitest";

import { defineApp } from "../src/index.ts";

describe("defineApp", () => {
  it("returns the definition unchanged (host validates at load)", () => {
    const def = defineApp({
      name: "n",
      description: "d",
      api: { ping: async () => "pong" },
    });
    expect(Object.keys(def.api)).toEqual(["ping"]);
  });
});
