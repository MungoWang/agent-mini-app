import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  DataGrid,
  DiffView,
  Editor,
  FileInput,
  Inline,
  JsonBlock,
  KeyValueEditor,
  LogViewer,
  Markdown,
  Stack,
  Stepper,
  SummaryBar,
  TagInput,
  Text,
  copyText,
  useDashboardApi,
} from "@monkeyagent/ui";

type LogLine = { level: string; text: string };
type TestCase = { id: string; name: string; status: string; duration: number };
type KV = { key: string; value: string };

const FIX_NOTE = `# 修复说明

**根因**：\`fetchWithRetry\` 缺少异常捕获与重试逻辑，网络抖动时直接抛错。

- 增加 \`retries\` 参数（默认 2 次重试）
- 用 \`try/catch\` 包裹请求，失败后循环重试
- 保留最后一次错误，重试耗尽时抛出

> 修复要点见下方 diff 对比，用例结果见底部表格。`;

function fmtTime(ts: number) {
  if (!ts) return "尚未保存";
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [tags, setTags] = useState<string[]>(["P0", "回归"]);
  const [config, setConfig] = useState<KV[]>([
    { key: "RETRY_TIMES", value: "3" },
    { key: "TIMEOUT_MS", value: "5000" },
  ]);
  const [savedAt, setSavedAt] = useState(0);
  const [stepOrientation, setStepOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await call("get", {});
      setBefore(d.before);
      setAfter(d.after);
      setLogs(d.logs);
      setCases(d.cases);
      setSavedAt(d.savedAt || 0);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setError(null);
    try {
      const r = await call("save", { after });
      setSavedAt(r.savedAt || Date.now());
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function reset() {
    setError(null);
    try {
      await call("reset", {});
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function copyDiff() {
    const unified =
      "--- 修复前\n+++ 修复后\n@@ -1," +
      before.split("\n").length +
      " +1," +
      after.split("\n").length +
      " @@\n" +
      before
        .split("\n")
        .map((l) => "-" + l)
        .join("\n") +
      "\n" +
      after
        .split("\n")
        .map((l) => "+" + l)
        .join("\n");
    const ok = await copyText(unified);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const pass = cases.filter((c) => c.status === "PASS").length;
  const fail = cases.filter((c) => c.status === "FAIL").length;
  const blocked = cases.filter((c) => c.status === "BLOCKED").length;

  return (
    <Stack gap={16} style={{ padding: 24, maxWidth: 980, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <Text variant="h2">修复工坊</Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            编辑修复方案、实时 diff 对比、执行日志与用例结果
          </Text>
        </div>
        <Inline gap={8}>
          <Button size="sm" variant="outline" onClick={() => void copyDiff()}>
            {copied ? "已复制" : "复制 diff"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reset()}>
            重置
          </Button>
          <Button size="sm" onClick={() => void save()}>
            保存修复
          </Button>
        </Inline>
      </Inline>

      <SummaryBar pass={pass} fail={fail} blocked={blocked} labels={{ pass: "通过", fail: "失败", blocked: "阻塞" }} />

      <Card>
        <CardHeader>
          <CardTitle>修复流程</CardTitle>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardDescription>当前步骤：实施修复 · 可切横向/纵向</CardDescription>
            <Inline gap={6}>
              <Button size="sm" variant={stepOrientation === "vertical" ? "default" : "outline"} onClick={() => setStepOrientation("vertical")}>
                纵向
              </Button>
              <Button size="sm" variant={stepOrientation === "horizontal" ? "default" : "outline"} onClick={() => setStepOrientation("horizontal")}>
                横向
              </Button>
            </Inline>
          </Inline>
        </CardHeader>
        <CardContent>
          <Stepper
            steps={[
              { title: "复现问题", description: "跑一次失败用例" },
              { title: "定位根因", description: "缺少异常捕获与重试" },
              { title: "实施修复", description: "编辑修复方案" },
              { title: "回归验证", description: "用例 2/4 通过" },
            ]}
            active={2}
            orientation={stepOrientation}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复说明</CardTitle>
          <CardDescription>Markdown 渲染</CardDescription>
        </CardHeader>
        <CardContent>
          <Markdown text={FIX_NOTE} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复后代码</CardTitle>
          <CardDescription>在编辑器里修改，下方 diff 实时对比</CardDescription>
        </CardHeader>
        <CardContent>
          <Editor value={after} onChange={setAfter} language="js" height={300} placeholder="// 在这里写修复方案" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复前后对比</CardTitle>
          <CardDescription>红色为删除，绿色为新增</CardDescription>
        </CardHeader>
        <CardContent>
          <DiffView oldText={before} newText={after} language="js" maxHeight={360} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复前代码（只读）</CardTitle>
          <CardDescription>CodeBlock：原始版本</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={before} language="js" copyable maxHeight={220} />
        </CardContent>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <CardHeader>
            <CardTitle>修复配置</CardTitle>
            <CardDescription>KeyValueEditor：环境变量</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueEditor value={config} onChange={setConfig} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>修复标签</CardTitle>
            <CardDescription>TagInput：回车添加，可建议</CardDescription>
          </CardHeader>
          <CardContent>
            <TagInput value={tags} onChange={setTags} suggestions={["P0", "P1", "回归", "冒烟", "性能", "安全"]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>执行日志</CardTitle>
          <CardDescription>LogViewer · 保存时间：{fmtTime(savedAt)}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogViewer lines={logs} maxHeight={180} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用例结果</CardTitle>
          <CardDescription>DataGrid：点击表头排序，勾选后导出 CSV，点击行写日志</CardDescription>
        </CardHeader>
        <CardContent>
          <DataGrid
            columns={[
              { key: "id", label: "用例" },
              { key: "name", label: "名称", sortable: true },
              { key: "status", label: "状态", sortable: true },
              { key: "duration", label: "耗时(ms)", sortable: true },
            ]}
            data={cases}
            selectable
            exportable
            exportFilename="fixbench-cases.csv"
            onRowClick={(row) =>
              setLogs((prev) => prev.concat([{ level: row.status === "PASS" ? "info" : "warn", text: `点击查看：${row.id} ${row.name} → ${row.status}` }]))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用例数据（JSON）</CardTitle>
          <CardDescription>JsonBlock：结构化查看 + 复制</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock data={{ savedAt, tags, config, cases }} maxHeight={240} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>导入修复方案</CardTitle>
          <CardDescription>FileInput：选择文件读取文本</CardDescription>
        </CardHeader>
        <CardContent>
          <FileInput
            accept=".js,.ts,.txt"
            multiple
            onFiles={(files) => {
              if (files.length) setAfter(files[0].text || after);
            }}
          />
        </CardContent>
      </Card>

      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}
      {loading && !before ? <Text variant="muted">加载中…</Text> : null}
    </Stack>
  );
}
