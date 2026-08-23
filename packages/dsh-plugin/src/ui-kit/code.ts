// @ts-nocheck
/**
 * @monkeyagent/ui — Code & Diff components (CodeMirror 6 based).
 * Editor / CodeBlock / JsonBlock / DiffView + copyText / parseUnified helpers.
 * All styling maps the host's shadcn CSS variables (--card/--muted/--primary...),
 * syntax colors follow html[data-theme] light/dark.
 */
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  lineNumbers as cmLineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { syntaxHighlighting, HighlightStyle, indentUnit, indentOnInput } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { xml } from "@codemirror/lang-xml";

function merge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

/* —— 基础主题：容器/光标/选区/提示用 CSS 变量，merge 高亮覆盖成鲜明红绿 —— */
const cmBaseTheme = EditorView.theme({
  "&": { backgroundColor: "var(--card)", color: "var(--card-foreground)", fontSize: "13px", height: "100%" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.55" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--primary)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "none", paddingRight: "4px", opacity: 0.85 },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 6px", minWidth: "26px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 24%, transparent)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--muted) 60%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--muted) 60%, transparent)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
  ".cm-placeholder": { color: "var(--muted-foreground)", opacity: 0.7 },
  ".cm-tooltip": {
    backgroundColor: "var(--card)", border: "1px solid var(--border)",
    color: "var(--card-foreground)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,.12)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)" },
  ".cm-searchMatch": { outline: "1px solid color-mix(in srgb, var(--primary) 60%, transparent)", backgroundColor: "transparent" },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)" },
  // merge view：Monaco diff 风格——行背景红/绿 + 行号 gutter 着色；
  // 词级改动用浅红/浅绿背景（覆盖 merge 默认的底部下划线）
  "&.cm-merge-a .cm-changedLine, .cm-deletedChunk": {
    backgroundColor: "color-mix(in srgb, #ef4444 18%, transparent)",
  },
  "&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine": {
    backgroundColor: "color-mix(in srgb, #22c55e 18%, transparent)",
  },
  "&.cm-merge-a .cm-changedLineGutter": { backgroundColor: "color-mix(in srgb, #ef4444 55%, transparent)", color: "#fff" },
  "&.cm-merge-b .cm-changedLineGutter": { backgroundColor: "color-mix(in srgb, #22c55e 55%, transparent)", color: "#fff" },
  "&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText": {
    backgroundColor: "color-mix(in srgb, #ef4444 32%, transparent)",
    textDecoration: "none",
    borderRadius: 2,
  },
  "&.cm-merge-b .cm-changedText": {
    backgroundColor: "color-mix(in srgb, #22c55e 32%, transparent)",
    textDecoration: "none",
    borderRadius: 2,
  },
  ".cm-merge-gap": { backgroundColor: "var(--muted)", opacity: 0.75 },
  ".cm-mergeView & .cm-scroller": { overflowY: "auto" },
});

/* —— 语法高亮：浅/深两套 —— */
const lightHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "#9a3cb2" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "#0a7d33" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#b45309" },
  { tag: [tags.comment], color: "#8a919c", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#1d4ed8" },
  { tag: [tags.propertyName, tags.attributeName], color: "#0f5a8a" },
  { tag: [tags.tagName], color: "#b91c1c" },
  { tag: [tags.operator, tags.punctuation], color: "#4b5563" },
  { tag: [tags.meta, tags.typeName], color: "#6b7280" },
  { tag: [tags.heading], color: "#1d4ed8", fontWeight: "600" },
  { tag: [tags.link], color: "#2563eb", textDecoration: "underline" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strong], fontWeight: "600" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "#c792ea" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "#9ece6a" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#ff9e64" },
  { tag: [tags.comment], color: "#6b7280", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#82aaff" },
  { tag: [tags.propertyName, tags.attributeName], color: "#7dcfff" },
  { tag: [tags.tagName], color: "#f7768e" },
  { tag: [tags.operator, tags.punctuation], color: "#9aa5b1" },
  { tag: [tags.meta, tags.typeName], color: "#a1a1aa" },
  { tag: [tags.heading], color: "#82aaff", fontWeight: "600" },
  { tag: [tags.link], color: "#7aa2f7", textDecoration: "underline" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strong], fontWeight: "600" },
]);

function cmThemeIsDark() {
  try {
    return document.documentElement.dataset.theme === "dark";
  } catch (_) {
    return false;
  }
}

function cmHighlightExt() {
  return syntaxHighlighting(cmThemeIsDark() ? darkHighlight : lightHighlight);
}

/* 语言字符串 → CM6 扩展 */
function langExt(language) {
  const map = {
    js: javascript(),
    javascript: javascript(),
    mjs: javascript(),
    ts: javascript({ typescript: true }),
    typescript: javascript({ typescript: true }),
    jsx: javascript({ jsx: true }),
    tsx: javascript({ jsx: true, typescript: true }),
    json: json(),
    sql: sql(),
    python: python(),
    py: python(),
    md: markdown(),
    markdown: markdown(),
    yaml: yaml(),
    yml: yaml(),
    html: html(),
    css: css(),
    xml: xml(),
    text: null,
  };
  return map[String(language || "").toLowerCase()] || [];
}

/* 剪贴板 helper（无 UI，返回 Promise<boolean>）
 * iframe 内 navigator.clipboard 常被 permissions policy 拦截（产生 console Violation），
 * 直接走 execCommand fallback；顶层安全上下文才优先 Clipboard API。 */
export async function copyText(text) {
  const s = String(text ?? "");
  const inIframe = (function () {
    try {
      return window.self !== window.top;
    } catch (_) {
      return true;
    }
  })();
  if (!inIframe && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(s);
      return true;
    } catch (_) {}
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.readOnly = true;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      ta.setSelectionRange(0, s.length);
    } catch (_) {}
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

/* unified diff 文本 → { oldText, newText }（解析 git diff，供 DiffView 渲染） */
export function parseUnified(text) {
  const oldLines = [];
  const newLines = [];
  const lines = String(text || "").split("\n");
  let inHunk = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    const c = line.charAt(0);
    if (c === "+") newLines.push(line.slice(1));
    else if (c === "-") oldLines.push(line.slice(1));
    else if (c === " ") {
      const s = line.slice(1);
      oldLines.push(s);
      newLines.push(s);
    } else if (c === "\\") {
      // "\ No newline at end of file"：忽略
    } else {
      inHunk = false; // 出 hunk，继续找下一个 @@
    }
  }
  return { oldText: oldLines.join("\n"), newText: newLines.join("\n") };
}

export function createCodeComponents(React: any) {
  const { useEffect, useRef, useState, createElement: h } = React;

  /* 受控编辑器：外部 value 变化 → 同步（自身输入不重复触发） */
  function useSyncDoc(viewRef, value) {
    useEffect(() => {
      const v = viewRef.current;
      if (!v) return;
      const cur = v.state.doc.toString();
      const next = String(value ?? "");
      if (cur !== next) {
        v.dispatch({ changes: { from: 0, to: cur.length, insert: next } });
      }
    }, [value]);
  }

  function Editor({ value = "", onChange, language, readOnly, placeholder, lineNumbers = true, height, minHeight, maxHeight, className, style }) {
    const ref = useRef(null);
    const viewRef = useRef(null);
    const langComp = useRef(new Compartment());
    const roComp = useRef(new Compartment());
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const view = new EditorView({
        parent: el,
        state: EditorState.create({
          doc: String(value ?? ""),
          extensions: [
            cmBaseTheme,
            cmHighlightExt(),
            lineNumbers ? cmLineNumbers() : [],
            highlightActiveLine(),
            indentOnInput(),
            indentUnit.of("  "),
            langComp.current.of(langExt(language)),
            roComp.current.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
            cmPlaceholder(placeholder || ""),
            EditorView.lineWrapping,
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            autocompletion(),
            keymap.of(completionKeymap),
            highlightSelectionMatches(),
            EditorView.updateListener.of((u) => {
              if (u.docChanged && onChangeRef.current) onChangeRef.current(u.state.doc.toString());
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const v = viewRef.current;
      if (!v) return;
      v.dispatch({ effects: langComp.current.reconfigure(langExt(language)) });
    }, [language]);

    useEffect(() => {
      const v = viewRef.current;
      if (!v) return;
      v.dispatch({
        effects: roComp.current.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
      });
    }, [readOnly]);

    useSyncDoc(viewRef, value);

    return h("div", {
      ref,
      className,
      style: merge({ height, minHeight, maxHeight, border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }, style),
    });
  }

  function CodeBlock({ code = "", language, lineNumbers = true, copyable, copiedLabel = "已复制", maxHeight, wrap, className, style }) {
    const ref = useRef(null);
    const viewRef = useRef(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const view = new EditorView({
        parent: el,
        state: EditorState.create({
          doc: String(code ?? ""),
          extensions: [
            cmBaseTheme,
            cmHighlightExt(),
            lineNumbers ? cmLineNumbers() : [],
            langExt(language),
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
            wrap ? EditorView.lineWrapping : [],
            EditorView.contentAttributes.of({ "aria-label": "code" }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useSyncDoc(viewRef, code);

    const doCopy = () => {
      copyText(code).then((ok) => {
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      });
    };

    return h("div", {
      className,
      style: merge({ position: "relative", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", maxHeight }, style),
    },
      copyable
        ? h("button", {
            type: "button",
            onClick: doCopy,
            style: {
              position: "absolute", top: 6, right: 6, zIndex: 3, height: 26, padding: "0 10px",
              fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)", background: "var(--card)",
              color: copied ? "var(--primary)" : "var(--muted-foreground)",
            },
          }, copied ? copiedLabel : "复制")
        : null,
      h("div", { ref })
    );
  }

  /* 简化 JSON 展示：格式化 + 高亮 + 复制（不做折叠树） */
  function JsonBlock({ data, text, copyable = true, maxHeight, className, style }) {
    const src =
      text !== undefined && text !== null
        ? String(text)
        : JSON.stringify(data, null, 2);
    return h(CodeBlock, { code: src, language: "json", copyable, maxHeight, className, style });
  }

  function resolveDiff(oldText, newText, unified) {
    if (unified !== undefined && unified !== null) return parseUnified(String(unified));
    return { oldText: String(oldText ?? ""), newText: String(newText ?? "") };
  }

  /* 只读双栏 diff：CM6 MergeView + 语法高亮 + 未变区块折叠 */
  function DiffView({ oldText = "", newText, unified, language, collapsible = true, maxHeight, className, style }) {
    const ref = useRef(null);
    const mvRef = useRef(null);
    const src = resolveDiff(oldText, newText, unified);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const shared = [
        cmBaseTheme,
        cmHighlightExt(),
        langExt(language),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
      ];
      const mv = new MergeView({
        // a/b 是 EditorStateConfig 对象（传 EditorState 实例会丢 extensions：高亮/只读不生效）
        a: { doc: String(src.oldText ?? ""), extensions: shared },
        b: { doc: String(src.newText ?? ""), extensions: shared },
        parent: el,
        highlightChanges: true, // 词级 diff 标记（样式用背景色，见 cmBaseTheme）
        collapseUnchanged: !!collapsible,
        revertControls: false,
        mergeControls: false,
      });
      mvRef.current = mv;
      return () => {
        try {
          mv.destroy();
        } catch (_) {}
        mvRef.current = null;
      };
    }, []);

    useEffect(() => {
      const mv = mvRef.current;
      if (!mv) return;
      const r = resolveDiff(oldText, newText, unified);
      try {
        mv.a.dispatch({ changes: { from: 0, to: mv.a.state.doc.length, insert: String(r.oldText ?? "") } });
        mv.b.dispatch({ changes: { from: 0, to: mv.b.state.doc.length, insert: String(r.newText ?? "") } });
      } catch (_) {}
    }, [oldText, newText, unified]);

    return h("div", {
      ref,
      className,
      style: merge({ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", maxHeight }, style),
    });
  }

  return { Editor, CodeBlock, JsonBlock, DiffView };
}
