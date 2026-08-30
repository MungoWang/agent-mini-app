import { describe, expect, it } from "vitest";

import {
  applyEditsToNormalizedContent,
  applyReplacementsPreservingUnchangedLines,
  detectLineEnding,
  fuzzyFindText,
  generateDiffString,
  generateUnifiedPatch,
  normalizeForFuzzyMatch,
  normalizeToLF,
  restoreLineEndings,
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

describe("line endings", () => {
  it("picks the first newline that appears", () => {
    expect(detectLineEnding("a\r\nb\n")).toBe("\r\n");
    expect(detectLineEnding("a\nb\r\n")).toBe("\n");
    expect(detectLineEnding("a\n")).toBe("\n");
    expect(detectLineEnding("no newlines at all")).toBe("\n");
  });

  it("normalizes CRLF and lone CR to LF, restores on demand", () => {
    expect(normalizeToLF("a\r\nb\rc")).toBe("a\nb\nc");
    expect(restoreLineEndings("a\nb", "\r\n")).toBe("a\r\nb");
    expect(restoreLineEndings("a\nb", "\n")).toBe("a\nb");
  });

  it("normalizes unicode dashes, spaces and trailing whitespace for matching", () => {
    expect(normalizeForFuzzyMatch("a\u2014b\u00A0c   \n")).toBe("a-b c\n");
    expect(normalizeForFuzzyMatch("\u2018q\u2019")).toBe("'q'");
  });

  it("reports an exact match in original content space", () => {
    const r = fuzzyFindText("alpha beta\n", "beta");
    expect(r).toMatchObject({ found: true, index: 6, matchLength: 4, usedFuzzyMatch: false });
    expect(r.contentForReplacement).toBe("alpha beta\n");
  });

  it("reports not-found with a -1 index", () => {
    expect(fuzzyFindText("alpha\n", "zzz")).toMatchObject({ found: false, index: -1, matchLength: 0 });
  });
});

describe("applyReplacementsPreservingUnchangedLines", () => {
  it("rewrites only touched lines and keeps the original bytes elsewhere", () => {
    const original = "alpha   \nbeta\ngamma\n";
    const base = normalizeForFuzzyMatch(original);
    const out = applyReplacementsPreservingUnchangedLines(original, base, [
      { matchIndex: base.indexOf("beta"), matchLength: 4, newText: "BETA" },
    ]);
    expect(out).toBe("alpha   \nBETA\ngamma\n");
  });

  it("merges replacements that fall in the same line range", () => {
    const base = "one two three\nnext\n";
    const out = applyReplacementsPreservingUnchangedLines(base, base, [
      { matchIndex: base.indexOf("two"), matchLength: 3, newText: "2" },
      { matchIndex: base.indexOf("three"), matchLength: 5, newText: "3" },
    ]);
    expect(out).toBe("one 2 3\nnext\n");
  });

  it("keeps untouched blocks between two separate groups", () => {
    const original = "a  \nb\n\nc\n\n\nd  \n";
    const base = normalizeForFuzzyMatch(original);
    const out = applyReplacementsPreservingUnchangedLines(original, base, [
      { matchIndex: base.indexOf("b"), matchLength: 1, newText: "B" },
      { matchIndex: base.indexOf("d"), matchLength: 1, newText: "D" },
    ]);
    expect(out).toBe("a  \nB\n\nc\n\n\nD\n");
  });

  it("refuses a base content with a different line count", () => {
    expect(() =>
      applyReplacementsPreservingUnchangedLines("a\n", "a\nb\n", [
        { matchIndex: 0, matchLength: 1, newText: "x" },
      ]),
    ).toThrow(/different line count/);
  });

  it("refuses replacement ranges outside the base content", () => {
    const base = "one\n";
    expect(() =>
      applyReplacementsPreservingUnchangedLines(base, base, [
        { matchIndex: 99, matchLength: 1, newText: "x" },
      ]),
    ).toThrow(/outside the base content/);
    expect(() =>
      applyReplacementsPreservingUnchangedLines(base, base, [
        { matchIndex: 0, matchLength: 99, newText: "x" },
      ]),
    ).toThrow(/outside the base content/);
  });
});

describe("applyEditsToNormalizedContent diagnostics", () => {
  it("names the failing edit when several are submitted", () => {
    expect(() =>
      applyEditsToNormalizedContent(
        "alpha\nbeta\n",
        [
          { oldText: "alpha", newText: "ALPHA" },
          { oldText: "nope", newText: "X" },
        ],
        "x.ts",
      ),
    ).toThrow(/Could not find edits\[1\] in x\.ts/);
  });

  it("counts occurrences per edit index", () => {
    expect(() =>
      applyEditsToNormalizedContent(
        "foo\nfoo\n",
        [
          { oldText: "foo", newText: "bar" },
          { oldText: "also missing", newText: "y" },
        ],
        "x.ts",
      ),
    ).toThrow(/Found 2 occurrences of edits\[0\] in x\.ts/);
  });

  it("rejects an empty oldText (single and multi edit)", () => {
    expect(() =>
      applyEditsToNormalizedContent("a\n", [{ oldText: "", newText: "x" }], "x.ts"),
    ).toThrow(/oldText must not be empty in x\.ts/);
    expect(() =>
      applyEditsToNormalizedContent(
        "a\nb\n",
        [
          { oldText: "a", newText: "A" },
          { oldText: "", newText: "x" },
        ],
        "x.ts",
      ),
    ).toThrow(/edits\[1\]\.oldText must not be empty in x\.ts/);
  });

  it("rejects a no-op replacement (single and multi edit)", () => {
    expect(() =>
      applyEditsToNormalizedContent("hello\n", [{ oldText: "hello", newText: "hello" }], "x.ts"),
    ).toThrow(/No changes made to x\.ts\. The replacement produced identical content/);
    expect(() =>
      applyEditsToNormalizedContent(
        "a\nb\n",
        [
          { oldText: "a", newText: "a" },
          { oldText: "b", newText: "b" },
        ],
        "x.ts",
      ),
    ).toThrow(/The replacements produced identical content/);
  });

  it("rejects overlapping edit ranges", () => {
    expect(() =>
      applyEditsToNormalizedContent(
        "hello world\n",
        [
          { oldText: "hello world", newText: "HW" },
          { oldText: "world", newText: "W" },
        ],
        "x.ts",
      ),
    ).toThrow(/edits\[0\] and edits\[1\] overlap in x\.ts/);
  });

  it("overlays fuzzy matches onto the original bytes", () => {
    const original = "say \u201Chello\u201D   \nbeta\ngamma   \n";
    const { baseContent, newContent } = applyEditsToNormalizedContent(
      original,
      [{ oldText: 'say "hello"\nbeta', newText: "ok\nBETA" }],
      "x.ts",
    );
    expect(baseContent).toBe(original);
    // touched lines come from the normalized base; untouched lines keep their bytes
    expect(newContent).toBe("ok\nBETA\ngamma   \n");
  });
});

describe("patch rendering", () => {
  it("generates a unified patch", () => {
    const patch = generateUnifiedPatch("a.txt", "one\ntwo\n", "one\n2\n");
    expect(patch).toContain("--- a.txt");
    expect(patch).toContain("+++ a.txt");
    expect(patch).toContain("@@ -1,2 +1,2 @@");
    expect(patch).toContain("-two");
    expect(patch).toContain("+2");
    expect(generateUnifiedPatch("a.txt", "x\n", "x\ny\n", 1)).toContain("+y");
  });

  it("renders a change with leading context and reports the first changed line", () => {
    const { diff, firstChangedLine } = generateDiffString("a\nb\n", "a\nB\n");
    expect(firstChangedLine).toBe(2);
    expect(diff).toContain("-2 b");
    expect(diff).toContain("+2 B");
    expect(diff).toContain(" 1 a");
  });

  it("elides a long context block sandwiched between two changes", () => {
    const middle = Array.from({ length: 12 }, (_, i) => `c${i + 1}`).join("\n");
    const { diff, firstChangedLine } = generateDiffString(
      `a1\n${middle}\nz1\n`,
      `b1\n${middle}\nz2\n`,
    );
    expect(firstChangedLine).toBe(1);
    expect(diff).toContain("c1");
    expect(diff).toContain("c12");
    expect(diff).not.toContain("c6");
    expect(diff).toMatch(/\.\.\./);
  });

  it("keeps trailing context after a single change but drops far context", () => {
    const middle = Array.from({ length: 12 }, (_, i) => `c${i + 1}`).join("\n");
    const near = generateDiffString("a1\nc1\nc2\n", "b1\nc1\nc2\n");
    expect(near.diff).toContain("c2");
    expect(near.diff).not.toMatch(/\.\.\./);

    const far = generateDiffString(`a1\n${middle}\n`, `b1\n${middle}\n`);
    expect(far.diff).toContain("c4");
    expect(far.diff).not.toContain("c9");
    expect(far.diff).toMatch(/\.\.\./);
  });

  it("shows only the tail context before a change at the end", () => {
    const middle = Array.from({ length: 12 }, (_, i) => `c${i + 1}`).join("\n");
    const { diff, firstChangedLine } = generateDiffString(`${middle}\nz1\n`, `${middle}\nz2\n`);
    expect(firstChangedLine).toBe(13);
    expect(diff).toContain("c9");
    expect(diff).toContain("c12");
    expect(diff).not.toContain("c5");
    expect(diff).toMatch(/\.\.\./);
  });

  it("prints a short context block in full between two changes", () => {
    const { diff } = generateDiffString("a\nc1\nc2\nb\n", "A\nc1\nc2\nB\n");
    expect(diff).toContain("c1");
    expect(diff).toContain("c2");
    expect(diff).not.toMatch(/\.\.\./);
  });

  it("returns an empty diff when nothing changed", () => {
    expect(generateDiffString("same\n", "same\n")).toEqual({ diff: "", firstChangedLine: undefined });
  });
});
