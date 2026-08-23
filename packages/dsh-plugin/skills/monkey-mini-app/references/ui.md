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

Tokens（Host 配色会整套写入）：`--background --foreground --card --card-foreground --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground --accent --accent-foreground --border --input --ring --destructive --destructive-foreground --radius --shadow`

iframe 从 **esm.sh** 拉 react / sucrase。不要为查 props 去读 `ui-kit.js`。
