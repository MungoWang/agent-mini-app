import { describe, it, expect } from "vitest";
import { parseUnified } from "./ui-kit/code.js";

describe("parseUnified（unified diff 文本 → oldText/newText）", () => {
  it("标准 diff：上下文/删除/新增", () => {
    const r = parseUnified("--- a/x\n+++ b/x\n@@ -1,3 +1,4 @@\n keep\n-old line\n+new line\n keep2\n+extra\n");
    expect(r.oldText).toBe("keep\nold line\nkeep2");
    expect(r.newText).toBe("keep\nnew line\nkeep2\nextra");
  });
  it("多 hunk 拼接", () => {
    const r = parseUnified(
      "@@ -1,1 +1,1 @@\n-a\n+b\n@@ -5,1 +6,1 @@\n-c\n+d\n"
    );
    expect(r.oldText).toBe("a\nc");
    expect(r.newText).toBe("b\nd");
  });
  it("忽略 \\ No newline at end of file 标记", () => {
    const r = parseUnified("@@ -1,1 +1,1 @@\n-old\n+new\n\\ No newline at end of file\n");
    expect(r.oldText).toBe("old");
    expect(r.newText).toBe("new");
  });
  it("只有删除", () => {
    const r = parseUnified("@@ -1,1 +0,0 @@\n-gone\n");
    expect(r.oldText).toBe("gone");
    expect(r.newText).toBe("");
  });
  it("空输入 / 无 hunk → 空字符串", () => {
    expect(parseUnified("")).toEqual({ oldText: "", newText: "" });
    expect(parseUnified("plain text without hunks")).toEqual({ oldText: "", newText: "" });
    expect(parseUnified(null)).toEqual({ oldText: "", newText: "" });
  });
  it("@@ 前的内容（文件头）被跳过", () => {
    const r = parseUnified("diff --git a/x b/x\nindex 000..111\n@@ -1,1 +1,1 @@\n-a\n+b\n");
    expect(r.oldText).toBe("a");
    expect(r.newText).toBe("b");
  });
});
