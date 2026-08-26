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

QA/Dev 工作流：`LogViewer`（级别着色/过滤/自动滚底）`Markdown`（极简渲染）`KeyValueEditor`（键值对行编辑）`TagInput`（标签输入+建议）`FileInput`（选择/拖拽/读文本）`Stepper`（步骤向导，orientation 可横/纵）`SummaryBar`（测试结果分段条）`DataGrid`（排序/选中/分页/CSV 导出/**列头搜索 popover**/**空状态插图**，TanStack headless）

看板与日历：

- `KanbanBoard` — 拖拽多栏卡片（Jira tickets）：`columns:[{id,title,accent}]` + `items:[{id,columnId,title,subtitle,...}]` + `onDragEnd({itemId,fromColumnId,toColumnId})`；`renderCard(item, col, dnd)` 自定义卡片 slot（不绑死样式；**dnd 为拖拽 props，自定义卡片也要 `{...dnd}` 才能拖**），默认卡片带 accent 色条/标题/副标题，列头计数。
- `Calendar` — Mini 月视图：受控 `value="YYYY-MM-DD"` + `onChange`；`events:[{date}]` 或 `mark(dateStr)` 在日期角标画事件圆点；选中主色底、今天描边（dark 兼容）。
- `FullCalendar` — **自绘 mac Calendar 布局**（月/周/日三视图，不用第三方日历库）：`events:[{id,title,start,end?,color?,allDay?}]`（start/end 支持 `"YYYY-MM-DD"` 天级与 `"YYYY-MM-DDTHH:mm"` 时间级）；`view/defaultView` 月/周/日切换；`hourStart/hourEnd` 控制时间跨度。**周/日视图 = 顶部日期头（每列周几+日期，今天红底圆标）+ 通栏 all-day 区 + 时间网格**；**跨天 all-day 事件是连续 bar**（gridColumn 跨列、lane 堆叠、超周边界截断），timed 事件重叠 lane 并排；各列时间格 top 全列对齐不错位。月视图跨天事件周行内连续长条。**交互**：单击选中、双击空白添加、pointer 拖选范围（月拖天、周/日拖时间段）→ 预填表单；**点击已有事件 → 编辑表单**（预填标题/时间/颜色），提交回调 **`onAddEvent({title,start,end,color,allDay})`** 或 **`onUpdateEvent({...event,新字段})`（保留原 id）**，由调用方持久化后回传（受控 events，不绑死）。事件表单用内置 DateInput/TimeInput（开始/结束日期+时间，min/max 双向约束）。mini + full 可共用同一 `events` 数据做切换（Mini 兼容 `{date}` 与 `{start}` 两种事件格式）。
- 日期时间输入族（内置，零依赖；shadcn 官方无原生 datetime 只有 Popover+Calendar）：`DateInput`（**popover 日历单选**）/`TimeInput`（原生 time）/`DateTimeInput`（popover 日期 + 原生时间）/`DateRangeInput`（**popover 日历拖选范围**）/`TimeRangeInput`/`DateTimeRangeInput`；支持受控 `value` 与非受控 `defaultValue`；range 双向 min/max 约束。

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
