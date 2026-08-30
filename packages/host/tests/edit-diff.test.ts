import { describe, expect, it } from "vitest";

import {
  applyEditsToNormalizedContent,
  fuzzyFindText,
  normalizeForFuzzyMatch,
} from "../src/apps/edit-diff.ts";

describe("edit-diff (Pi port)", () => {
  it("applies a unique exact replacement", () => {
    const { newContent } = applyEditsToNormalizedContent(
      "const a = 1;\nconst b = 2;\n",
      [{ oldText: "const b = 2;", newText: "const b = 3;" }],
      "x.ts",
    );
    expect(newContent).toBe("const a = 1;\nconst b = 3;\n");
  });

  it("rejects non-unique oldText", () => {
    expect(() =>
      applyEditsToNormalizedContent(
        "foo\nfoo\n",
        [{ oldText: "foo", newText: "bar" }],
        "x.ts",
      ),
    ).toThrow(/unique/i);
  });

  it("rejects missing oldText", () => {
    expect(() =>
      applyEditsToNormalizedContent("hello\n", [{ oldText: "missing", newText: "x" }], "x.ts"),
    ).toThrow(/Could not find/);
  });

  it("fuzzy-matches smart quotes", () => {
    const content = "say \u201Chello\u201D\n";
    const match = fuzzyFindText(content, 'say "hello"');
    expect(match.found).toBe(true);
    expect(match.usedFuzzyMatch).toBe(true);
    expect(normalizeForFuzzyMatch(content)).toContain('say "hello"');
  });

  it("applies multiple disjoint edits against the original snapshot", () => {
    const { newContent } = applyEditsToNormalizedContent(
      "one\ntwo\nthree\n",
      [
        { oldText: "one", newText: "1" },
        { oldText: "three", newText: "3" },
      ],
      "x.ts",
    );
    expect(newContent).toBe("1\ntwo\n3\n");
  });
});
