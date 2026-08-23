// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createUiKit } from "./ui-kit.js";

const ui = createUiKit(React);
const { Editor, CodeBlock, JsonBlock, DiffView, copyText } = ui;

async function mount(el: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(el);
  });
  return { container, root };
}
async function rerender(root: { render: (e: React.ReactNode) => void }, el: React.ReactNode) {
  await act(async () => {
    root.render(el);
  });
}
afterEach(() => {
  document.body.innerHTML = "";
});

describe("Editor（CodeMirror 6）", () => {
  it("渲染 .cm-editor + 行号 + 语法高亮", async () => {
    const { container, root } = await mount(
      React.createElement(Editor, { value: "const x = 1;", language: "js", height: 120 })
    );
    expect(container.querySelector(".cm-editor")).toBeTruthy();
    expect(container.querySelector(".cm-gutter.cm-lineNumbers")).toBeTruthy();
    expect(container.querySelector(".cm-content")!.textContent).toContain("const x = 1");
    const edTokColors = Array.from(container.querySelectorAll("#none .cm-content span")); // placeholder
    // CM6 高亮为 StyleModule class 模式：token span 的 computed color 与默认前景不同
    const edDefault = getComputedStyle(container.querySelector(".cm-content")!).color;
    const edAny = Array.from(container.querySelectorAll(".cm-content span")).some((n) => getComputedStyle(n).color !== edDefault);
    expect(edAny).toBe(true);
    unmountSafe(root);
  });
  it("受控 value 更新同步到编辑器", async () => {
    const { container, root } = await mount(
      React.createElement(Editor, { value: "aaa", language: "js" })
    );
    await rerender(root, React.createElement(Editor, { value: "bbb\nccc", language: "js" }));
    const content = container.querySelector(".cm-content")!.textContent || "";
    expect(content).toContain("bbb");
    expect(content).toContain("ccc");
    unmountSafe(root);
  });
  it("readOnly 不可编辑", async () => {
    const { container, root } = await mount(
      React.createElement(Editor, { value: "read only", language: "text", readOnly: true })
    );
    const view = (container.querySelector(".cm-editor") as HTMLElement)?.__view as { state: { readOnly: boolean } };
    // 通过 CM 的 DOM 属性验证只读（contenteditable=false 或 readOnly 扩展）
    expect(container.querySelector(".cm-content")!.getAttribute("contenteditable")).toBe("false");
    unmountSafe(root);
  });
});

describe("CodeBlock / JsonBlock", () => {
  it("CodeBlock 渲染代码 + 复制按钮", async () => {
    const { container, root } = await mount(
      React.createElement(CodeBlock, { code: "const a = 1;", language: "js", copyable: true })
    );
    expect(container.querySelector(".cm-editor")).toBeTruthy();
    expect(container.textContent).toContain("const a = 1");
    expect(container.querySelector("button")?.textContent).toContain("复制");
    unmountSafe(root);
  });
  it("JsonBlock 格式化 JSON", async () => {
    const { container, root } = await mount(React.createElement(JsonBlock, { data: { ok: true, items: [1, 2] } }));
    expect(container.querySelector(".cm-content")!.textContent).toContain('"ok"');
    unmountSafe(root);
  });
});

describe("DiffView（MergeView）", () => {
  it("oldText/newText 双栏渲染 + 内容", async () => {
    const { container, root } = await mount(
      React.createElement(DiffView, { oldText: "a\nb", newText: "a\nc", language: "text" })
    );
    const editors = container.querySelectorAll(".cm-editor");
    expect(editors.length).toBeGreaterThanOrEqual(2); // 双栏
    const text = container.textContent || "";
    expect(text).toContain("c");
    unmountSafe(root);
  });
  it("language=js 时语法高亮生效（.tok-* 高亮类）", async () => {
    const { container, root } = await mount(
      React.createElement(DiffView, { oldText: "const x = 1;\nfunction f() {}", newText: "const x = 2;\nfunction f() { return 1; }", language: "js" })
    );
    const dDefault = getComputedStyle(container.querySelector(".cm-content")!).color;
    const dAny = Array.from(container.querySelectorAll(".cm-content span")).some((n) => getComputedStyle(n).color !== dDefault);
    expect(dAny).toBe(true); // 至少一个 token 颜色不同于默认前景
    unmountSafe(root);
  });
  it("词级 diff：changedText 标记存在且为背景色（非下划线）", async () => {
    const { container, root } = await mount(
      React.createElement(DiffView, { oldText: "hello world", newText: "hello there", language: "text" })
    );
    const marks = container.querySelectorAll(".cm-changedText");
    expect(marks.length).toBeGreaterThan(0); // 词级 diff 保留
    const anyUnderline = Array.from(marks).some((n) => {
      const st = getComputedStyle(n);
      return st.textDecorationLine.indexOf("underline") >= 0;
    });
    expect(anyUnderline).toBe(false); // 不是底线样式
    unmountSafe(root);
  });
  it("unified 文本渲染", async () => {
    const { container, root } = await mount(
      React.createElement(DiffView, { unified: "@@ -1,1 +1,1 @@\n-old\n+new\n" })
    );
    const text = container.textContent || "";
    expect(text).toContain("old");
    expect(text).toContain("new");
    unmountSafe(root);
  });
});

describe("copyText", () => {
  it("无 clipboard 环境降级且不抛错（返回 boolean）", async () => {
    const r = await copyText("hello");
    expect(typeof r).toBe("boolean");
  });
});

function unmountSafe(root: { unmount: () => void }) {
  try {
    act(() => root.unmount());
  } catch {
    /* noop */
  }
}
