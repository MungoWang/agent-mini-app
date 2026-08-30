import { describe, expect, it } from "vitest";

import { coerceSchemaJson, withJsonInstruction } from "../src/llm-stream.ts";

describe("structured JSON helpers (llm + agent shared)", () => {
  it("withJsonInstruction leaves plain prompts unchanged", () => {
    expect(withJsonInstruction("hi", undefined)).toEqual({ prompt: "hi", system: undefined });
    expect(withJsonInstruction("hi", { system: "be brief" })).toEqual({
      prompt: "hi",
      system: "be brief",
    });
  });

  it("withJsonInstruction appends schema instructions into system", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    const { prompt, system } = withJsonInstruction("extract", { schema, system: "zh" });
    expect(prompt).toBe("extract");
    expect(system).toContain("zh");
    expect(system).toContain("JSON Schema");
    expect(system).toContain('"a"');
  });

  it("coerceSchemaJson peels fences and preamble when schema is set", () => {
    const opts = { schema: { type: "object" } };
    expect(coerceSchemaJson('```json\n{"a":1}\n```', opts)).toBe('{"a":1}');
    expect(coerceSchemaJson('Here you go:\n{"a":1}\nThanks', opts)).toBe('{"a":1}');
    expect(coerceSchemaJson("[1,2]", opts)).toBe("[1,2]");
  });

  it("coerceSchemaJson is a no-op without schema", () => {
    const raw = '```json\n{"a":1}\n```';
    expect(coerceSchemaJson(raw, undefined)).toBe(raw);
    expect(coerceSchemaJson(raw, {})).toBe(raw);
  });
});
