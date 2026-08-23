// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createUiKit } from "./ui-kit.js";

const ui = createUiKit(React);
const { DataGrid, Stepper, TagInput, SummaryBar, LogViewer, Markdown, JsonBlock, KeyValueEditor } = ui;

async function mount(el: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(el);
  });
  return { container, root };
}
function unmount(root: { unmount: () => void }) {
  act(() => root.unmount());
}
afterEach(() => {
  document.body.innerHTML = "";
});

const ROWS = [
  { id: "TC-01", name: "登录成功", status: "PASS", duration: 120 },
  { id: "TC-02", name: "登录失败重试", status: "FAIL", duration: 3012 },
  { id: "TC-03", name: "注销", status: "PASS", duration: 98 },
];
const COLS = [
  { key: "id", label: "用例" },
  { key: "name", label: "名称", sortable: true },
  { key: "status", label: "状态", sortable: true },
  { key: "duration", label: "耗时(ms)", sortable: true },
];

describe("DataGrid（TanStack headless）", () => {
  it("渲染表头/行/排序箭头/导出按钮", async () => {
    const { container, root } = await mount(React.createElement(DataGrid, { columns: COLS, data: ROWS, exportable: true }));
    const ths = Array.from(container.querySelectorAll("th")).map((n) => n.textContent || "");
    expect(ths.some((t) => t.includes("名称"))).toBe(true);
    expect(container.querySelectorAll("tbody tr").length).toBe(3);
    expect(ths.some((t) => t.includes("↕"))).toBe(true); // 未排序常显箭头
    expect(container.textContent).toContain("导出 CSV");
    expect(container.querySelector("th[title='点击排序']")).toBeTruthy();
    unmount(root);
  });

  it("点击表头排序：箭头变 ▲、行序变化", async () => {
    const { container, root } = await mount(React.createElement(DataGrid, { columns: COLS, data: ROWS }));
    const nameTh = Array.from(container.querySelectorAll("th")).find((n) => (n.textContent || "").includes("名称"))!;
    await act(async () => {
      nameTh.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const sortedTh = Array.from(container.querySelectorAll("th")).find((n) => (n.textContent || "").includes("名称"))!;
    expect(sortedTh.textContent).toContain("▲");
    const firstRow = container.querySelector("tbody tr td:nth-child(2)")!.textContent;
    // TanStack 字符串排序按 Unicode 码点：注(U+6CE8) < 登(U+767B) → 升序第一"注销"
    expect(firstRow).toBe("注销");
    await act(async () => {
      nameTh.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector("tbody tr td:nth-child(2)")!.textContent).toBe("登录成功"); // 降序：成(U+6210) > 失(U+5931)
    unmount(root);
  });

  it("checkbox 选中：行高亮 + onSelectionChange 回调", async () => {
    const onSel = vi.fn();
    const { container, root } = await mount(
      React.createElement(DataGrid, { columns: COLS, data: ROWS, selectable: true, onSelectionChange: onSel })
    );
    const cb = container.querySelector("tbody input[type=checkbox]") as HTMLInputElement;
    await act(async () => {
      cb.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const rowStyle = (container.querySelector("tbody tr") as HTMLElement).style.background;
    expect(rowStyle).toContain("color-mix"); // 选中高亮
    expect(onSel).toHaveBeenCalled();
    expect(onSel.mock.calls.at(-1)![0]).toEqual([{ id: "TC-01", name: "登录成功", status: "PASS", duration: 120 }]);
    unmount(root);
  });

  it("空数据 → empty 文案", async () => {
    const { container, root } = await mount(React.createElement(DataGrid, { columns: COLS, data: [] }));
    expect(container.textContent).toContain("暂无数据");
    unmount(root);
  });
});

describe("Stepper", () => {
  const steps = [
    { title: "准备环境", description: "拉起服务" },
    { title: "执行用例" },
    { title: "对比基线", description: "与上次 diff" },
    { title: "出报告" },
  ];
  it("纵向：active 描边主色、done 非白字（淡主色底）、todo 灰、线激活=目标步完成", async () => {
    const { container, root } = await mount(React.createElement(Stepper, { steps, active: 2 }));
    const html = container.innerHTML;
    expect(html).toContain("color-mix"); // done 圈淡主色底
    const circles = Array.from(container.querySelectorAll("div")).filter((d) => (d.style.borderRadius || "").includes("50%"));
    expect(circles.length).toBe(4);
    expect(circles.every((c) => c.style.backgroundColor !== "var(--primary)" && !c.style.backgroundColor.startsWith("var(--primary)"))).toBe(true); // 无圈的背景是纯主色实底
    expect(html).toContain("border-color: var(--primary)"); // active 圈描边
    unmount(root);
  });
  it("横向：对称线 6 段、无 gap、圆点 box-sizing 统一、线激活=目标步完成", async () => {
    const { container, root } = await mount(React.createElement(Stepper, { steps, active: 2, orientation: "horizontal" }));
    const html = container.innerHTML;
    const lines = html.match(/height:\s*2px/g) || [];
    expect(lines.length).toBe(6); // 4 步 = 6 段线（相邻相接）
    expect(html).not.toContain("gap: 8px");
    expect(html).toContain("margin-right: 8px"); // 线到圆点间距
    // 圆点 box-sizing: border-box（active 2px border 不撑大行高 → 线在同一水平）
    const circles = Array.from(container.querySelectorAll("div")).filter((d) => (d.style.borderRadius || "").includes("50%"));
    expect(circles.every((c) => c.style.boxSizing === "border-box")).toBe(true);
    // 线激活语义：active=2 → 1→2 线激活（步1右 + 步2左 = 2 段 primary）；2→3、3→4 未激活（border）
    const activeLines = (html.match(/background: var\(--primary\)/g) || []).length;
    expect(activeLines).toBe(2);
    unmount(root);
  });
});

describe("TagInput / 基础组件渲染", () => {
  it("TagInput：chips 渲染、input 文字色 inherit（dark 可见）", async () => {
    const { container, root } = await mount(
      React.createElement(TagInput, { value: ["P0", "回归"], suggestions: ["P0", "P1"] })
    );
    expect(container.textContent).toContain("P0");
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.style.color).toBe("inherit");
    expect(container.textContent).toContain("回归");
    unmount(root);
  });
  it("SummaryBar：分段条 + 计数，语义色跟随主题变量", async () => {
    const { container, root } = await mount(React.createElement(SummaryBar, { pass: 9, fail: 2, blocked: 1, skip: 3 }));
    const t = container.textContent || "";
    expect(t).toContain("通过");
    expect(t).toContain("共 15 项");
    const html = container.innerHTML;
    expect(html).toContain("var(--primary)"); // 通过段跟随主题主色
    expect(html).toContain("var(--destructive)"); // 失败段跟随主题
    expect(html).not.toContain("#22c55e"); // 不再写死绿色
    unmount(root);
  });
  it("LogViewer：级别着色行渲染", async () => {
    const { container, root } = await mount(
      React.createElement(LogViewer, { lines: ["INFO start", "ERROR boom", "WARN retry"] })
    );
    const t = container.textContent || "";
    expect(t).toContain("INFO start");
    expect(t).toContain("ERROR boom");
    expect(container.innerHTML).toContain("rgb(220, 38, 38)"); // error 红色（jsdom 规范化）
    unmount(root);
  });
  it("Markdown：标题/代码块/列表渲染", async () => {
    const { container, root } = await mount(
      React.createElement(Markdown, { text: "# 标题\n- 项一\n```js\nconst a = 1;\n```" })
    );
    expect(container.querySelector("h1")?.textContent).toBe("标题");
    expect(container.querySelector("li")?.textContent).toBe("项一");
    expect(container.querySelector("pre code")?.textContent).toContain("const a = 1");
    unmount(root);
  });
  it("JsonBlock：格式化 JSON 输出", async () => {
    const { container, root } = await mount(React.createElement(JsonBlock, { data: { ok: true, n: 2 } }));
    expect(container.textContent).toContain('"ok"');
    expect(container.textContent).toContain("true");
    unmount(root);
  });
  it("KeyValueEditor：行编辑 + 添加按钮", async () => {
    const { container, root } = await mount(
      React.createElement(KeyValueEditor, { value: [{ key: "A", value: "1" }] })
    );
    expect(container.querySelectorAll("input").length).toBe(2);
    expect(container.textContent).toContain("+ 添加");
    unmount(root);
  });
});

describe("Progress 主题跟随", () => {
  it("fill 用 var(--primary)，切换主题变量即变色", async () => {
    const { Progress } = ui;
    const { container, root } = await mount(React.createElement(Progress, { value: 60 }));
    const fill = container.querySelector(".mma-progress > div") as HTMLElement;
    expect(fill.style.background).toBe("var(--primary)");
    const track = container.querySelector(".mma-progress") as HTMLElement;
    expect(track.style.background).toBe("var(--muted)");
    unmount(root);
  });
});
