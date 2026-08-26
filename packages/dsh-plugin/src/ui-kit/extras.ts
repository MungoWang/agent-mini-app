// @ts-nocheck
/**
 * @monkeyagent/ui — QA/Dev 工作流组件（零依赖）。
 * LogViewer / Markdown / KeyValueEditor / TagInput / FileInput / Stepper / SummaryBar。
 * createExtras(React, ui)：ui 为 createUiKit 内的基础组件（Input/Button/Text 等）。
 */
function merge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const codeStyle = {
  fontFamily: MONO,
  fontSize: "12px",
  background: "var(--muted)",
  padding: "1px 5px",
  borderRadius: 5,
};

/* —— LogViewer：日志流展示（级别着色 / 过滤 / 自动滚底） —— */
function detectLevel(line) {
  if (/(error|fatal|exception|failed|fail:|✗)/i.test(line)) return "error";
  if (/(warn|warning|⚠)/i.test(line)) return "warn";
  if (/(debug|trace)/i.test(line)) return "debug";
  if (/(passed|pass|✓|ok\b|success)/i.test(line)) return "success";
  return "info";
}
const LOG_COLORS = {
  error: { light: "#dc2626", dark: "#f87171" },
  warn: { light: "#d97706", dark: "#fbbf24" },
  debug: { light: "#8a919c", dark: "#9ca3af" },
  success: { light: "#16a34a", dark: "#4ade80" },
  info: null,
};

import { createKanban } from "./kanban.js";
import { createCalendar } from "./calendar.js";

export function createExtras(React, ui) {
  const { useEffect, useRef, useState, createElement: el, Fragment } = React;
  const { Button, Input } = ui;

  function LogViewer({ lines = [], autoScroll = true, filter = "", lineNumbers = true, maxHeight = 320, className, style }) {
    const ref = useRef(null);
    const items = lines.map((l) => {
      if (l && typeof l === "object" && "text" in l) {
        return { level: l.level || detectLevel(l.text), text: String(l.text) };
      }
      const t = String(l ?? "");
      return { level: detectLevel(t), text: t };
    });
    const filtered = filter ? items.filter((it) => it.text.toLowerCase().indexOf(String(filter).toLowerCase()) >= 0) : items;
    useEffect(() => {
      if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [filtered.length, filter, autoScroll]);
    const dark = (function () { try { return document.documentElement.dataset.theme === "dark"; } catch (_) { return false; } })();
    return el("div", {
      ref,
      className,
      style: merge({
        fontFamily: MONO, fontSize: 12, lineHeight: 1.6,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "auto", maxHeight,
        padding: "8px 0",
      }, style),
    },
      filtered.map((it, i) =>
        el("div", {
          key: i,
          style: {
            display: "flex", gap: 8, padding: "0 12px", whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            ...(LOG_COLORS[it.level] ? { color: LOG_COLORS[it.level][dark ? "dark" : "light"] } : null),
          },
        },
          lineNumbers ? el("span", { style: { color: "var(--muted-foreground)", opacity: 0.6, flex: "0 0 auto", minWidth: 34, textAlign: "right", userSelect: "none" } }, String(i + 1)) : null,
          el("span", { style: { flex: 1, minWidth: 0 } }, it.text)
        )
      ),
      filtered.length ? null : el("div", { style: { padding: "10px 12px", color: "var(--muted-foreground)", opacity: 0.7 } }, "（无匹配行）")
    );
  }

  /* —— Markdown：极简渲染（标题/粗斜体/行内代码/代码块/列表/引用/链接/分隔线） —— */
  function inlineMarkup(text) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.length > 4 && tok.startsWith("**") && tok.endsWith("**")) out.push(el("strong", { key: out.length }, tok.slice(2, -2)));
      else if (tok.length > 2 && tok.startsWith("*") && tok.endsWith("*")) out.push(el("em", { key: out.length }, tok.slice(1, -1)));
      else if (tok.length > 2 && tok.startsWith("`")) out.push(el("code", { key: out.length, style: codeStyle }, tok.slice(1, -1)));
      else {
        const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (lm) out.push(el("a", { key: out.length, href: lm[2], target: "_blank", rel: "noreferrer", style: { color: "var(--primary)" } }, lm[1]));
        else out.push(tok);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function parseMarkdown(src) {
    const out = [];
    const lines = String(src || "").split("\n");
    let i = 0;
    let list = null;
    const flushList = () => {
      if (list) {
        out.push(el(list.ordered ? "ol" : "ul", { key: out.length, style: { margin: "6px 0", paddingLeft: 22 } },
          list.items.map((it, k) => el("li", { key: k }, inlineMarkup(it)))));
        list = null;
      }
    };
    while (i < lines.length) {
      const line = lines[i];
      const codeMatch = line.match(/^```(\w*)/);
      if (codeMatch) {
        flushList();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push(el("pre", { key: out.length, style: { background: "var(--muted)", borderRadius: 8, padding: "10px 12px", overflowX: "auto", margin: "8px 0" } },
          el("code", { style: { fontFamily: MONO, fontSize: 12 } }, buf.join("\n"))));
        continue;
      }
      const hd = line.match(/^(#{1,4})\s+(.*)$/);
      if (hd) {
        flushList();
        out.push(el("h" + hd[1].length, { key: out.length, style: { margin: "14px 0 6px", fontWeight: 600, lineHeight: 1.3 } }, inlineMarkup(hd[2])));
        i++;
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        flushList();
        out.push(el("hr", { key: out.length, style: { border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" } }));
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        flushList();
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push(el("blockquote", { key: out.length, style: { borderLeft: "3px solid var(--border)", paddingLeft: 12, margin: "8px 0", color: "var(--muted-foreground)" } }, inlineMarkup(buf.join("\n"))));
        continue;
      }
      const ul = line.match(/^[-*]\s+(.*)$/);
      if (ul) {
        if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
        list.items.push(ul[1]);
        i++;
        continue;
      }
      const ol = line.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
        list.items.push(ol[1]);
        i++;
        continue;
      }
      flushList();
      if (!line.trim()) { i++; continue; }
      const para = [];
      while (
        i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) &&
        !/^(#{1,4})\s/.test(lines[i]) && !/^>\s?/.test(lines[i]) &&
        !/^[-*]\s+/.test(lines[i]) && !/^\d+[.)]\s+/.test(lines[i])
      ) { para.push(lines[i]); i++; }
      out.push(el("p", { key: out.length, style: { margin: "6px 0" } }, inlineMarkup(para.join(" "))));
    }
    flushList();
    return out;
  }

  function Markdown({ text = "", className, style }) {
    return el("div", {
      className,
      style: merge({ lineHeight: 1.65, fontSize: 13.5, color: "var(--card-foreground)", wordBreak: "break-word" }, style),
    }, parseMarkdown(text));
  }

  /* —— KeyValueEditor：键值对行编辑（环境变量 / headers） —— */
  function KeyValueEditor({ value = [], onChange, keyPlaceholder = "key", valuePlaceholder = "value", rows, className, style }) {
    const list = Array.isArray(value) ? value.map((r) => ({ key: r && r.key !== undefined ? r.key : "", value: r && r.value !== undefined ? r.value : "" })) : Object.keys(value).map((k) => ({ key: k, value: value[k] }));
    function setRow(i, patch) {
      const next = list.slice();
      next[i] = Object.assign({}, next[i], patch);
      onChange(next);
    }
    function removeRow(i) {
      onChange(list.filter((_, j) => j !== i));
    }
    function addRow() {
      onChange(list.concat([{ key: "", value: "" }]));
    }
    return el("div", { className, style: merge({ display: "flex", flexDirection: "column", gap: 6 }, style) },
      list.map((r, i) =>
        el("div", { key: i, style: { display: "flex", gap: 6 } },
          el(Input, { value: r.key, placeholder: keyPlaceholder, onChange: (e) => setRow(i, { key: e.target.value }), style: { flex: "0 0 38%", fontFamily: MONO } }),
          el(Input, { value: r.value, placeholder: valuePlaceholder, onChange: (e) => setRow(i, { value: e.target.value }), style: { fontFamily: MONO } }),
          el(Button, { size: "sm", variant: "ghost", onClick: () => removeRow(i), title: "删除", "aria-label": "删除" }, "✕")
        )
      ),
      el(Button, { size: "sm", variant: "outline", onClick: addRow, style: { alignSelf: "flex-start" } }, "+ 添加")
    );
  }

  /* —— TagInput：标签输入（回车/逗号添加、退格删除、建议） —— */
  function TagInput({ value = [], onChange, suggestions = [], placeholder = "输入后回车", maxTags, className, style }) {
    const [draft, setDraft] = useState("");
    const list = Array.isArray(value) ? value : [];
    function commit() {
      const t = draft.trim();
      if (!t || (maxTags && list.length >= maxTags)) return;
      if (list.indexOf(t) >= 0) { setDraft(""); return; }
      onChange(list.concat(t));
      setDraft("");
    }
    function remove(t) {
      onChange(list.filter((x) => x !== t));
    }
    const matches = draft.trim() ? suggestions.filter((s) => s.toLowerCase().indexOf(draft.trim().toLowerCase()) >= 0 && list.indexOf(s) < 0).slice(0, 6) : [];
    return el("div", { className, style: merge({ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 6, background: "var(--card)" }, style) },
      list.map((t) =>
        el("span", { key: t, style: { display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 4px 0 9px", borderRadius: 7, background: "var(--muted)", fontSize: 12, fontWeight: 600 } },
          t,
          el("button", { type: "button", onClick: () => remove(t), style: { border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "0 4px", fontSize: 13, lineHeight: 1 } }, "×")
        )
      ),
      el("div", { style: { position: "relative", flex: 1, minWidth: 120 } },
        el("input", {
          value: draft,
          placeholder,
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
            else if (e.key === "Backspace" && !draft && list.length) onChange(list.slice(0, -1));
          },
          style: { border: "none", outline: "none", background: "none", font: "inherit", width: "100%", padding: "4px 2px", color: "inherit" },
        }),
        matches.length
          ? el("div", { style: { position: "absolute", top: "100%", left: 0, zIndex: 20, marginTop: 4, minWidth: 140, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,.12)" } },
              matches.map((s) =>
                el("button", { key: s, type: "button", onClick: () => { onChange(list.concat(s)); setDraft(""); }, style: { display: "block", width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: "5px 8px", borderRadius: 6, fontSize: 12 } }, s)
              )
            )
          : null
      )
    );
  }

  /* —— FileInput：文件选择 + 拖拽 + 文本读取 —— */
  function FileInput({ accept, multiple = false, onFiles, label = "选择文件", hint = "或拖拽到此处", maxSizeMB = 5, className, style }) {
    const inputRef = useRef(null);
    const [drag, setDrag] = useState(false);
    const [items, setItems] = useState([]);
    function read(files) {
      if (!files || !files.length) return;
      Promise.all(
        Array.from(files).map((f) => new Promise((res) => {
          const reader = new FileReader();
          const item = { name: f.name, size: f.size, type: f.type || "text/plain", text: "" };
          reader.onload = () => { item.text = String(reader.result || ""); res(item); };
          reader.onerror = () => res(item);
          if (f.size > maxSizeMB * 1024 * 1024) { item.text = ""; res(item); }
          reader.readAsText(f);
        }))
      ).then((list) => { setItems(list); onFiles && onFiles(list); });
    }
    function onDrop(e) {
      e.preventDefault();
      setDrag(false);
      read(e.dataTransfer.files);
    }
    return el("div", { className, style: merge({}, style) },
      el("div", {
        onClick: () => inputRef.current && inputRef.current.click(),
        onDragOver: (e) => { e.preventDefault(); setDrag(true); },
        onDragLeave: () => setDrag(false),
        onDrop,
        style: {
          border: "1.5px dashed " + (drag ? "var(--primary)" : "var(--border)"),
          borderRadius: "var(--radius)", padding: "18px 12px", textAlign: "center",
          cursor: "pointer", background: drag ? "var(--accent)" : "var(--card)", transition: "border-color .15s ease",
        },
      },
        el("div", { style: { fontWeight: 600, fontSize: 13 } }, label),
        el("div", { style: { fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 } }, hint + (maxSizeMB ? `（单个 ≤ ${maxSizeMB}MB，读取文本）` : ""))
      ),
      el("input", {
        ref: inputRef,
        type: "file",
        accept,
        multiple,
        style: { display: "none" },
        onChange: (e) => { read(e.target.files); e.target.value = ""; },
      }),
      items.length
        ? el("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 4 } },
            items.map((it, i) =>
              el("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 8px", background: "var(--muted)", borderRadius: 6 } },
                el("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 } }, it.name),
                el("span", { style: { color: "var(--muted-foreground)" } }, (it.size / 1024).toFixed(1) + " KB"),
                el("button", { type: "button", onClick: () => setItems(items.filter((_, j) => j !== i)), style: { border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" } }, "✕")
              )
            )
          )
        : null
    );
  }

  /* —— Stepper：步骤向导（垂直/水平） —— */
  function Stepper({ steps = [], active = 0, orientation = "vertical", className, style }) {
    const vertical = orientation !== "horizontal";
      const circle = (status, i) => {
      const isActive = i === active;
      const done = status === "done" || i < active;
      const error = status === "error";
      const base = {
        width: 26, height: 26, boxSizing: "border-box", borderRadius: "50%", flex: "0 0 26px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700,
      };
      // 用拆分属性（borderWidth/style/color），React 对 border 简写 + var()/color-mix() 的解析不可靠
      if (done)
        return Object.assign({
          backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)",
          color: "var(--primary)",
          borderWidth: 1, borderStyle: "solid", borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)",
        }, base);
      if (error)
        return Object.assign({
          backgroundColor: "var(--destructive)",
          color: "#fff",
          borderWidth: 1, borderStyle: "solid", borderColor: "transparent",
        }, base);
      if (isActive)
        return Object.assign({
          borderWidth: 2, borderStyle: "solid", borderColor: "var(--primary)",
          color: "var(--primary)",
        }, base);
      return Object.assign({
        borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)",
        color: "var(--muted-foreground)",
      }, base);
    };
    return el("div", { className, style: merge({ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 0 : 0 }, style) },
      steps.map((s, i) => {
        const st = s.status || (i < active ? "done" : i === active ? "doing" : "todo");
        const node = el("div", { key: i, style: { display: "flex", gap: 10, alignItems: "flex-start", flex: vertical ? undefined : 1, minWidth: 0 } },
          el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: vertical ? undefined : 26 } },
            el("div", { style: circle(st, i) }, st === "done" ? "✓" : st === "error" ? "!" : String(i + 1)),
            // 连接线激活语义：目标步（i+1）已完成才激活（与横向一致）
            vertical && i < steps.length - 1
              ? el("div", { style: { width: 2, flex: 1, minHeight: 18, background: i + 1 < active ? "var(--primary)" : "var(--border)", margin: "2px 0" } })
              : null
          ),
          vertical
            ? el("div", { style: { paddingBottom: 14, minWidth: 0 } },
                el("div", { style: { fontSize: 13, fontWeight: i <= active ? 650 : 500, color: st === "error" ? "var(--destructive)" : "inherit" } }, s.title),
                s.description ? el("div", { style: { fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 } }, s.description) : null
              )
            : null
        );
        if (vertical) return node;
        // 横向：左线 + 圆点 + 右线（圆点居中，线连接到相邻圆点；首尾用占位保持对称）
        // 线激活 = 目标步已完成：左线(→i) 看 i、右线(→i+1) 看 i+1 是否已完成
        return el("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 } },
          el("div", { style: { display: "flex", alignItems: "center", width: "100%" } },
            i > 0
              ? el("div", { style: { height: 2, flex: 1, marginRight: 8, background: i < active ? "var(--primary)" : "var(--border)", borderRadius: 1 } })
              : el("div", { style: { flex: 1 } }),
            el("div", { style: circle(st, i) }, st === "done" ? "✓" : st === "error" ? "!" : String(i + 1)),
            i < steps.length - 1
              ? el("div", { style: { height: 2, flex: 1, marginLeft: 8, background: i + 1 < active ? "var(--primary)" : "var(--border)", borderRadius: 1 } })
              : el("div", { style: { flex: 1 } })
          ),
          el("div", { style: { marginTop: 8, textAlign: "center", maxWidth: 160 } },
            el("div", { style: { fontSize: 13, fontWeight: i <= active ? 650 : 500, color: st === "error" ? "var(--destructive)" : "inherit" } }, s.title),
            s.description ? el("div", { style: { fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.4 } }, s.description) : null
          )
        );
      })
    );
  }

  /* —— SummaryBar：测试结果汇总（分段条 + 计数） —— */
  function SummaryBar({ pass = 0, fail = 0, blocked = 0, skip = 0, labels, className, style }) {
    const total = pass + fail + blocked + skip;
    const segs = [
      // 语义色跟随主题：通过=primary、失败=destructive；阻塞/跳过保留语义色
      { v: pass, color: "var(--primary)", label: (labels && labels.pass) || "通过" },
      { v: fail, color: "var(--destructive)", label: (labels && labels.fail) || "失败" },
      { v: blocked, color: "#f59e0b", label: (labels && labels.blocked) || "阻塞" },
      { v: skip, color: "var(--muted-foreground)", label: (labels && labels.skip) || "跳过" },
    ].filter((s) => s.v > 0);
    return el("div", { className, style: merge({ display: "flex", flexDirection: "column", gap: 8 }, style) },
      total
        ? el("div", { style: { display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "var(--muted)" } },
            segs.map((s, i) => el("div", { key: i, style: { width: (s.v / total) * 100 + "%", background: s.color } }))
          )
        : el("div", { style: { height: 10, borderRadius: 99, background: "var(--muted)" } }),
      el("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 } },
        segs.map((s, i) =>
          el("span", { key: i, style: { display: "inline-flex", alignItems: "center", gap: 5 } },
            el("i", { style: { width: 8, height: 8, borderRadius: 99, background: s.color, display: "inline-block" } }),
            s.label,
            el("b", { style: { fontWeight: 700 } }, s.v)
          )
        ),
        el("span", { style: { color: "var(--muted-foreground)", marginLeft: "auto" } }, "共 " + total + " 项")
      )
    );
  }

  /* —— 日期时间输入组件族（popover 日历 + range 拖选） —— */
  const { useState: useSt, useRef: useRf, useEffect: useEf } = React;
  function pad2(n) { return String(n).padStart(2, "0"); }
  function dStr(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseD(s) { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function todayS() { return dStr(new Date()); }
  function subM(month) { return month.m === 0 ? { y: month.y - 1, m: 11 } : { y: month.y, m: month.m - 1 }; }
  function addM(month) { return month.m === 11 ? { y: month.y + 1, m: 0 } : { y: month.y, m: month.m + 1 }; }
  function monthOf(s) { const d = parseD(s) || new Date(); return { y: d.getFullYear(), m: d.getMonth() }; }
  function weekCells(y, m) {
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      cells.push({ d, str: dStr(d), inMonth: d.getMonth() === m });
    }
    return cells;
  }
  // 日历面板：单选（mode=single）或拖选范围（mode=range）
  function CalPanel({ month, setMonth, sel, range, mode, min, max, onPick, onRange, onDone }) {
    const dragRf = useRf(null);
    useEf(() => {
      if (mode !== "range") return;
      const mv = (e) => {
        if (!dragRf.current) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest ? el.closest("[data-date]") : null;
        if (cell) onRange && onRange({ start: dragRf.current, end: cell.getAttribute("data-date") });
      };
      const up = () => { dragRf.current = null; };
      document.addEventListener("pointermove", mv);
      document.addEventListener("pointerup", up);
      return () => {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
      };
    }, [mode]);
    const cells = weekCells(month.y, month.m);
    return el("div", { style: { width: 284 } },
      el("div", { style: { display: "flex", alignItems: "center", marginBottom: 6 } },
        el(Button, { size: "sm", variant: "ghost", onClick: () => setMonth(subM(month)) }, "‹"),
        el("b", { style: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: 650 } }, month.y + " 年 " + (month.m + 1) + " 月"),
        el(Button, { size: "sm", variant: "ghost", onClick: () => setMonth(addM(month)) }, "›")
      ),
      el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 } },
        ["日", "一", "二", "三", "四", "五", "六"].map((w) => el("div", { key: w, style: { height: 20, lineHeight: "20px", textAlign: "center", fontSize: 10, color: "var(--muted-foreground)" } }, w)),
        cells.map(({ d, str, inMonth }) => {
          const disabled = (min && str < min) || (max && str > max);
          const inR = mode === "range" && range && str >= range.start && str <= range.end;
          const isEdge = inR && (str === range.start || str === range.end);
          const isSel = mode === "single" && str === sel;
          const isToday = str === todayS();
          return el("div", {
            key: str,
            "data-date": str,
            onPointerDown: (e) => {
              e.preventDefault();
              if (disabled) return;
              if (mode === "range") { dragRf.current = str; onRange && onRange({ start: str, end: str }); }
              else onPick && onPick(str);
            },
            onPointerOver: () => {
              if (dragRf.current && mode === "range" && !disabled) onRange && onRange({ start: dragRf.current, end: str });
            },
            onPointerUp: () => { dragRf.current = null; },
            style: {
              height: 30, lineHeight: "30px", textAlign: "center", fontSize: 12.5, borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", userSelect: "none",
              opacity: inMonth ? 1 : 0.35,
              background: isEdge ? "var(--primary)" : isSel ? "var(--primary)" : inR ? "color-mix(in srgb, var(--primary) 16%, transparent)" : undefined,
              color: isEdge || isSel ? "#fff" : undefined,
              boxShadow: isToday && !isSel && !isEdge ? "inset 0 0 0 1px var(--primary)" : undefined,
            },
          }, d.getDate());
        })
      ),
      mode === "range"
        ? el("div", { style: { marginTop: 8, display: "flex", justifyContent: "flex-end" } },
            el(Button, { size: "sm", onClick: () => { onRange && onRange(range); onDone && onDone(); } }, "确定")
          )
        : null
    );
  }
  function toMin(t) { if (!t) return 0; const m = /^(\d{1,2}):(\d{2})/.exec(String(t)); return m ? (+m[1] * 60 + +m[2]) % 1440 : 0; }
  function toHM(min) { return pad2(Math.floor(min / 60) % 24) + ":" + pad2(min % 60); }
  // 时间面板：每 30 分钟一格
  function TimePanel({ value, onPick }) {
    const mins = [];
    for (let m = 0; m < 1440; m += 30) mins.push(m);
    return el("div", { style: { width: 208 } },
      el("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 } },
        mins.map((m) => {
          const t = toHM(m);
          const isSel = value && t === value;
          return el("div", { key: t, "data-time": t, onClick: () => onPick && onPick(t), style: { height: 30, lineHeight: "30px", textAlign: "center", fontSize: 12.5, borderRadius: 5, cursor: "pointer", background: isSel ? "var(--primary)" : undefined, color: isSel ? "#fff" : "var(--card-foreground)" } }, t);
        })
      )
    );
  }
  // popover 面板：fixed 定位 + 高 z-index（Dialog 内容盒 overflow:visible 不裁剪）；
  // 不迁移 DOM（React 事件委托 root 容器，移出会丢事件）
  function PopPanel({ open, anchorEl, width, children }) {
    if (!open || !anchorEl || typeof document === "undefined") return null;
    const rect = anchorEl.getBoundingClientRect();
    let top = rect.bottom + 4;
    const left = Math.max(6, Math.min(rect.left, window.innerWidth - width - 6));
    const ph = 320;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 4); // 下方不足 → 向上翻
    return el("div", { "data-pop-panel": "", style: { position: "fixed", top, left, width, zIndex: 9999 } },
      el("div", { style: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 8, boxShadow: "0 10px 28px var(--shadow)", maxHeight: 460, overflowY: "auto", scrollbarWidth: "thin", boxSizing: "border-box" } }, children)
    );
  }
  function usePopover() {
    const [open, setOpen] = useSt(false);
    const rf = useRf(null);
    useEf(() => {
      if (!open) return;
      const h = (e) => {
        const inPanel = e.target && e.target.closest && e.target.closest("[data-pop-panel]");
        if (rf.current && !rf.current.contains(e.target) && !inPanel) setOpen(false);
      };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [open]);
    return { open, setOpen, rf };
  }
  // 单选日期（popover 日历）
  function DateInput({ value, defaultValue, onChange, min, max, style, ...rest }) {
    const controlled = value !== undefined;
    const [internal, setInternal] = useSt(defaultValue || "");
    const v = controlled ? (value || "") : internal;
    const set = (nv) => { if (!controlled) setInternal(nv); if (onChange) onChange(nv); };
    const { open, setOpen, rf } = usePopover();
    const [month, setMonth] = useSt(monthOf(v || defaultValue));
    return el("div", { ref: rf, style: merge({ position: "relative" }, style) },
      el(Input, Object.assign({ type: "text", value: v, placeholder: "YYYY-MM-DD", style: { width: "100%", boxSizing: "border-box" }, onFocus: () => { setOpen(true); setMonth(monthOf(v || defaultValue)); }, onChange: (e) => set(e.target.value) }, rest)),
      open ? el(PopPanel, { open, anchorEl: rf.current, width: 300 }, el(CalPanel, { month, setMonth, sel: v, mode: "single", min, max, onPick: (d) => { set(d); setOpen(false); } })) : null
    );
  }
  // 时间（text + popover 时间面板，30 分钟粒度 + 手输）
  function TimeInput({ value, defaultValue, onChange, style, ...rest }) {
    const controlled = value !== undefined;
    const [internal, setInternal] = useSt(defaultValue || "");
    const v = controlled ? (value || "") : internal;
    const set = (nv) => { if (!controlled) setInternal(nv); if (onChange) onChange(nv); };
    const { open, setOpen, rf } = usePopover();
    return el("div", { ref: rf, style: merge({ position: "relative" }, style) },
      el(Input, Object.assign({ type: "text", value: v, placeholder: "HH:mm", style: { width: "100%", boxSizing: "border-box" }, onChange: (e) => set(e.target.value), onFocus: () => setOpen(true) }, rest)),
      open ? el(PopPanel, { open, anchorEl: rf.current, width: 224 }, el(TimePanel, { value: v, onPick: (t) => { set(t); setOpen(false); } })) : null
    );
  }
  // 日期 + 时间（popover 选日期 + 原生时间）
  function DateTimeInput({ value, defaultValue, onChange, style, ...rest }) {
    const controlled = value !== undefined;
    const [internal, setInternal] = useSt(defaultValue || "");
    const v = controlled ? (value || "") : internal;
    const set = (nv) => { if (!controlled) setInternal(nv); if (onChange) onChange(nv); };
    const { open, setOpen, rf } = usePopover();
    const [month, setMonth] = useSt(monthOf(v));
    const dt = parseD(v);
    const datePart = dt ? dStr(dt) : (v ? String(v).slice(0, 10) : "");
    const timePart = v && String(v).length > 10 ? String(v).slice(11, 16) : "";
    return el("div", { ref: rf, style: merge({ position: "relative" }, style) },
      el("div", { style: { display: "flex", gap: 4 } },
        el(Input, { style: { flex: 1, minWidth: 0, width: "100%" }, type: "text", value: datePart, placeholder: "YYYY-MM-DD", onFocus: () => { setOpen(true); setMonth(monthOf(datePart)); }, onChange: (e) => set(e.target.value ? e.target.value + (timePart ? "T" + timePart : "") : "") }),
        el(TimeInput, { value: timePart, style: { flex: 1, minWidth: 0 }, onChange: (t) => set(datePart ? datePart + "T" + t : (t ? "T" + t : "")) })
      ),
      open ? el(PopPanel, { open, anchorEl: rf.current, width: 300 }, el(CalPanel, { month, setMonth, sel: datePart, mode: "single", onPick: (d) => { set(d + (timePart ? "T" + timePart : "")); setOpen(false); } })) : null
    );
  }
  function RangeWrap({ children, separator }) {
    return el("div", { style: { display: "flex", gap: 6, alignItems: "center", width: "100%" } },
      children[0],
      el("span", { style: { color: "var(--muted-foreground)", fontSize: 11, flex: "0 0 auto" } }, separator || "–"),
      children[1]
    );
  }
  // 日期范围（单框显示 "start – end"，点击弹日历拖选）
  function DateRangeInput({ value, defaultValue, onChange, style, ...rest }) {
    const controlled = value !== undefined;
    const [internal, setInternal] = useSt(defaultValue || {});
    const v = controlled ? (value || {}) : internal;
    const set = (nv) => { if (!controlled) setInternal(nv); if (onChange) onChange(nv); };
    const { open, setOpen, rf } = usePopover();
    const [month, setMonth] = useSt(monthOf(v.start || v.end || ""));
    const text = v.start && v.end ? v.start + " – " + v.end : (v.start || v.end || "");
    return el("div", { ref: rf, style: merge({ position: "relative" }, style) },
      el(Input, { type: "text", value: text, placeholder: "选择日期范围", readOnly: true, style: { width: "100%", boxSizing: "border-box" }, onFocus: () => { setOpen(true); setMonth(monthOf(v.start || v.end || "")); } }),
      open ? el(PopPanel, { open, anchorEl: rf.current, width: 300 }, el(CalPanel, { month, setMonth, range: v, mode: "range", onRange: (r) => set(r), onDone: () => setOpen(false) })) : null
    );
  }
  // 时间范围（双滑块：拖动起止 handle，显示 start – end）
  function TimeRangeInput({ value, defaultValue, onChange, style, ...rest }) {
    const controlled = value !== undefined;
    const [internal, setInternal] = useSt(defaultValue || { start: "09:00", end: "10:30" });
    const v = controlled ? (value || {}) : internal;
    const set = (nv) => { if (!controlled) setInternal(nv); if (onChange) onChange(nv); };
    const dragRf = useRf(null); // "start" | "end"
    const trackRf = useRf(null);
    useEf(() => {
      const mv = (e) => {
        const which = dragRf.current;
        if (!which || !trackRf.current) return;
        const rect = trackRf.current.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const min = Math.round((ratio * 1440) / 15) * 15;
        const sMin = toMin(v.start);
        const eMin = toMin(v.end);
        if (which === "start") set({ start: toHM(Math.min(min, eMin - 15)), end: v.end });
        else set({ start: v.start, end: toHM(Math.max(min, sMin + 15)) });
      };
      const up = () => { dragRf.current = null; };
      document.addEventListener("pointermove", mv);
      document.addEventListener("pointerup", up);
      return () => {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
      };
    }, [v.start, v.end]);
    const pct = (t) => (toMin(t) / 1440) * 100;
    const pS = pct(v.start);
    const pE = pct(v.end);
    const handle = (which, p) =>
      el("div", {
        key: which,
        onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); dragRf.current = which; },
        style: {
          position: "absolute", left: p + "%", top: "50%", width: 16, height: 16, marginLeft: -8, marginTop: -8,
          borderRadius: 99, background: "var(--card)", border: "2px solid var(--primary)", cursor: "ew-resize",
          boxShadow: "0 1px 3px var(--shadow)", zIndex: 2,
        },
      });
    return el("div", { style: merge({ display: "flex", flexDirection: "column", gap: 7 }, style) },
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 650 } },
        el("span", null, v.start),
        el("span", { style: { color: "var(--muted-foreground)", fontWeight: 500 } }, "–"),
        el("span", null, v.end)
      ),
      el("div", { ref: trackRf, style: { position: "relative", height: 10, borderRadius: 5, background: "var(--muted)", cursor: "pointer" } },
        el("div", { style: { position: "absolute", left: pS + "%", width: Math.max(pE - pS, 0.5) + "%", top: 0, height: 10, background: "var(--primary)", borderRadius: 5, opacity: 0.85 } }),
        handle("start", pS),
        handle("end", pE)
      ),
      el("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)" } }, "00:00", "12:00", "24:00")
    );
  }
  function DateTimeRangeInput({ value, defaultValue, onChange, style, ...rest }) {
    const v = value || defaultValue || {};
    const dv = defaultValue || null;
    return el(RangeWrap, { separator: rest.separator },
      el(DateTimeInput, Object.assign({ style: { flex: 1, minWidth: 0 }, value: v.start, defaultValue: dv ? dv.start : undefined, onChange: (s) => onChange && onChange({ start: s, end: v.end }) }, rest.startProps)),
      el(DateTimeInput, Object.assign({ style: { flex: 1, minWidth: 0 }, value: v.end, defaultValue: dv ? dv.end : undefined, onChange: (e) => onChange && onChange({ start: v.start, end: e }) }, rest.endProps))
    );
  }

  const kanban = createKanban(React, ui);
  const cal = createCalendar(React, ui, { DateInput, TimeInput, DateRangeInput, TimeRangeInput, DateTimeRangeInput });
  return Object.assign({ LogViewer, Markdown, KeyValueEditor, TagInput, FileInput, Stepper, SummaryBar, DateInput, TimeInput, DateTimeInput, DateRangeInput, TimeRangeInput, DateTimeRangeInput }, kanban, cal);
}
