# UI

```tsx
import { useEffect, useState } from "react";
import { Button, Stack, Text, useDashboardApi } from "@monkeyagent/ui";

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setData(await call("latest", {}));
    } catch (e) {
      setError(String((e && e.message) || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Stack style={{ padding: 24, gap: 16, maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Text variant="h2">标题</Text>
      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}
      <Text>{(data && data.summary) || (loading ? "加载中…" : "还没有内容")}</Text>
      <Button disabled={loading} onClick={() => void reload()}>
        {loading ? "刷新中…" : "刷新"}
      </Button>
    </Stack>
  );
}
```

- `useDashboardApi()` **只**返回 `{ call }`，不要 `useDashboardApi("list", args)`
- 禁止：fetch、secrets、llm/bash/mcp、`window.mini`
- 允许 import：`react`、`@monkeyagent/ui`、`./components/*`、`./lib/*`
- 禁止：`@/`、随机 npm、`lucide-react` / `recharts`（用袋里的 `Sparkline` / `ChartContainer`）
- 文案给用户看：中文产品语言，不要写 `ctx.bash` / `storage/*.json`

## 组件袋（shadcn 同名，轻量）

Layout: `Stack Inline Box Text Heading Surface Separator ScrollArea Breadcrumb`

Button: `variant` default|secondary|outline|ghost|destructive|link；`size` default|sm|lg|icon

Form: `Input Textarea Label Checkbox Switch Select SelectItem Slider RadioGroup Field`

Display: `Card* Badge Avatar Progress Skeleton Spinner Empty Alert* Kbd`

Data: `Table*`  Nav: `Tabs* Accordion*`  Overlay: `Dialog* Tooltip Sheet* Popover toast`

QA/Dev 工作流：`LogViewer`（级别着色/过滤/自动滚底）`Markdown`（极简渲染）`KeyValueEditor`（键值对行编辑）`TagInput`（标签输入+建议）`FileInput`（选择/拖拽/读文本）`Stepper`（步骤向导）`SummaryBar`（测试结果分段条）`DataGrid`（排序/选中/分页/CSV 导出，TanStack headless）

```tsx
<LogViewer lines={logs} filter="ERROR" />
<Markdown text={md} />
<KeyValueEditor value={pairs} onChange={setPairs} />
<TagInput value={tags} onChange={setTags} suggestions={["P0", "回归"]} />
<FileInput multiple onFiles={(files) => setFiles(files)} />
<Stepper steps={steps} active={2} />
<SummaryBar pass={9} fail={2} blocked={1} skip={3} />
<DataGrid columns={cols} data={rows} selectable exportable sortable />
```

Code & Diff（CodeMirror 6，零外部依赖）：

- `Editor` — 代码编辑：`value/onChange/language/readOnly/placeholder/height`；`language` 支持 `js/ts/jsx/tsx/json/sql/python/md/yaml/html/css/xml`；行号、Tab 缩进、撤销、自动补全、语法高亮
- `CodeBlock` — 只读代码：`code/language/lineNumbers/copyable/maxHeight/wrap`
- `JsonBlock` — JSON 展示：`data`（对象）或 `text`（字符串），格式化 + 高亮 + 复制，无折叠树
- `DiffView` — 只读双栏 diff：`oldText+newText` 或 `unified`（git diff 文本）；`language/collapsible/maxHeight`；红绿行级高亮 + 语法高亮 + 未变区块折叠
- `copyText(text)` — 剪贴板 helper（无 UI，返回 Promise<boolean>），自绘复制按钮请用它
- `parseUnified(text)` — unified diff 文本 → `{ oldText, newText }`

```tsx
// 编辑 + 对比
<Editor value={sql} onChange={setSql} language="sql" height={220} />
<DiffView oldText={before} newText={after} language="ts" />
<DiffView unified={gitDiffText} />
<CodeBlock code={json} language="json" copyable />
<JsonBlock data={obj} />
```

Tokens（Host 配色会整套写入）：`--background --foreground --card --card-foreground --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground --accent --accent-foreground --border --input --ring --destructive --destructive-foreground --radius --shadow`

iframe 从 **esm.sh** 拉 react / sucrase。不要为查 props 去读 `ui-kit.js`。
