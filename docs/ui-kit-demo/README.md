# ui-kit 代码组件 demo

CodeMirror 6 组件（Editor / CodeBlock / JsonBlock / DiffView）的独立演示页。

## 跑起来

```bash
cd docs/ui-kit-demo
python3 -m http.server 8123
# 打开 http://127.0.0.1:8123/ （react 走 CDN）
# 深色：http://127.0.0.1:8123/?theme=dark
```

## 组件清单（P0）

- `Editor` — 代码编辑（行号/Tab/撤销/补全/语法高亮），`language` 支持 js/ts/jsx/tsx/json/sql/python/md/yaml/html/css/xml
- `CodeBlock` — 只读代码 + 可选复制按钮
- `JsonBlock` — JSON 格式化展示 + 复制（无折叠树）
- `DiffView` — 只读双栏 diff（`oldText/newText` 或 `unified` git diff 文本），语法高亮 + 红绿行级高亮 + 未变区块折叠
- `copyText(text)` — 剪贴板 helper（无 UI）
- `parseUnified(diffText)` — unified diff 文本 → `{oldText, newText}`

主题：跟随 `html[data-theme]`（light/dark 两套语法色），容器背景/边框/选中用 iframe 的 shadcn CSS 变量（`--card/--muted/--primary/--accent/--border`），和 app 现有组件自动搭配。
