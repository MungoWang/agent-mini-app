import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ColumnDef,
  DataGrid,
  FileDropzone,
  Icon,
  IlluEmpty,
  ListDetail,
  Spinner,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useApp,
} from "@monkey-mini-app/ui";

type ColumnStat = {
  header: string;
  numeric: boolean;
  count: number;
  min?: number;
  max?: number;
  total?: number;
  avg?: number;
};

type Sheet = {
  name: string;
  headers: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  columns: ColumnStat[];
};

type Report = {
  id: string;
  fileName: string;
  createdAt: number;
  sheetCount: number;
  rowCount: number;
  digest?: { headline: string; bullets: string[] };
};

/**
 * ⭐ The browser hands us bytes; the workbook is parsed in the **backend** by exceljs.
 * A chat-generated HTML page would need SheetJS in the browser and would stop at whatever
 * fits in one file — here the same bytes reach a Node client with the full format.
 */
async function readAsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ⭐ Look: desk-split — walnut desk, one warm lamp, ink only ever lands on paper.
//   Wood grain: fine + wide stripe bands; lamp pool from the palette's amber primary;
//   vignette pulls the corners down. All token-derived, no colour literals.
const DESK =
  "repeating-linear-gradient(90deg, color-mix(in oklch, var(--foreground) 5%, transparent) 0 2px, transparent 2px 26px)," +
  "repeating-linear-gradient(90deg, color-mix(in oklch, var(--foreground) 8%, transparent) 0 1px, transparent 1px 96px)," +
  "radial-gradient(620px 320px at 12% -12%, color-mix(in oklch, var(--primary) 42%, transparent), transparent 70%)," +
  "radial-gradient(560px 620px at 64% 116%, color-mix(in oklch, var(--foreground) 16%, transparent), transparent 72%)";

// One sheet of cream desk-paper: hairline edge, contact + lift shadow, a light along the
// top edge. Inline because Tailwind collapses the extra inset layer of arbitrary shadows.
const PAPER = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
  boxShadow:
    "0 1px 2px color-mix(in oklch, var(--foreground) 24%, transparent)," +
    "0 18px 44px -18px var(--shadow)," +
    "inset 0 1px 0 color-mix(in oklch, var(--card) 72%, transparent)",
  borderColor: "color-mix(in oklch, var(--foreground) 12%, transparent)",
} as const;

export default function Ui() {
  const { call } = useApp();
  const [history, setHistory] = useState<Report[]>([]);
  const [report, setReport] = useState<(Report & { sheets?: Sheet[] }) | null>(
    null,
  );
  const [sheet, setSheet] = useState("");
  const [busy, setBusy] = useState<"idle" | "reading" | "digesting">("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setHistory(((await call("list")) ?? []) as Report[]);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (id: string) => {
    const found = history.find((r) => r.id === id);
    if (!found) return;
    setReport(found);
    setError("");
  };

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setError("只支持 .xlsx（旧版 .xls 请先另存为 .xlsx）");
      return;
    }
    setError("");
    setBusy("reading");
    try {
      const base64 = await readAsBase64(file);
      const parsed = (await call("ingest", {
        fileName: file.name,
        base64,
      })) as Report & {
        sheets: Sheet[];
      };
      setReport(parsed);
      setSheet(parsed.sheets?.[0]?.name ?? "");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const runDigest = async () => {
    if (!report) return;
    setBusy("digesting");
    setError("");
    try {
      const digest = (await call("digest", { id: report.id })) as {
        headline: string;
        bullets: string[];
      };
      setReport({ ...report, digest });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const forget = async (id: string) => {
    await call("remove", { id });
    if (report?.id === id) setReport(null);
    await refresh();
  };

  // ⭐ key: ListDetail shows `empty` only when `detail` is literally undefined. Passing an
  //   always-present wrapper div swallows the drop target, and the app opens on a blank pane.
  const hasRecord = Boolean(report) || busy === "reading" || Boolean(error);

  const sheets = report?.sheets ?? [];
  const active = useMemo(
    () => sheets.find((s) => s.name === sheet) ?? sheets[0],
    [sheets, sheet],
  );

  // ⭐ Columns come from the file, so the grid is built at runtime — no fixed schema.
  const columns = useMemo<ColumnDef<Record<string, string | number>>[]>(() => {
    if (!active) return [];
    return active.headers.map((h) => ({
      accessorKey: h,
      header: h,
      meta: { sort: true, search: "text" },
    }));
  }, [active]);

  const numeric = active?.columns.filter((c) => c.numeric) ?? [];

  return (
    // ⭐ Look: desk-split — the desk is the palette's walnut `bg-background`; ink only ever
    //   lands on paper (`bg-card`). One long sheet: a letterhead strip on top, the ListDetail
    //   binder below it. The papers stay cream in BOTH modes — lamp-lit paper on a dark desk
    //   is the look; dark papers on wood read as mud.
    <div className="bg-background relative flex h-full min-h-0 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: DESK }}
      />
      <header
        style={PAPER}
        className="relative mx-5 mt-4 rounded-t-2xl border border-b-0 px-5 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-lg font-semibold tracking-tight">
              表格台
            </h1>
            <p className="text-muted-foreground text-xs">
              Excel 在本机解析，数值汇总后交给宿主模型出结论
            </p>
          </div>
          {report ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void forget(report.id)}
            >
              <Icon.Trash2 />
              删除
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!report || busy !== "idle"}
            onClick={() => void runDigest()}
          >
            {busy === "digesting" ? (
              <Spinner className="size-3.5" />
            ) : (
              <Icon.Sparkles />
            )}
            生成摘要
          </Button>
        </div>
      </header>
      <div className="relative mx-5 mb-5 flex min-h-0 flex-1">
        <div
          style={PAPER}
          className="flex h-full min-h-0 w-full overflow-hidden rounded-b-2xl border border-t-0"
        >
          <ListDetail
            toolbar={
              <div className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2 text-xs font-medium tracking-wide uppercase">
                <Icon.History className="size-3.5" />
                历史报表
                <Badge variant="outline" className="ml-auto normal-case">
                  {history.length}
                </Badge>
              </div>
            }
            list={
              <ul className="divide-border divide-y">
                {history.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => void open(r.id)}
                      className={
                        "hover:bg-accent flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs " +
                        (report?.id === r.id ? "bg-accent" : "")
                      }
                    >
                      <span className="line-clamp-1 font-medium">
                        {r.fileName}
                      </span>
                      <span className="text-muted-foreground">
                        {r.sheetCount} 表 · {r.rowCount} 行
                        {r.digest ? " · 已摘要" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            }
            detail={
              hasRecord ? (
                <div className="flex flex-col gap-4 p-4">
                  {error ? (
                    <div className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Icon.AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}
                  {busy === "reading" ? (
                    <Card>
                      <CardContent className="flex items-center gap-2 py-6 text-sm">
                        <Spinner className="size-4" />
                        正在读取工作簿…
                      </CardContent>
                    </Card>
                  ) : null}

                  {report && busy !== "reading" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <StatCard title="工作表" value={report.sheetCount} />
                        <StatCard title="数据行" value={report.rowCount} />
                        <StatCard title="数值列" value={numeric.length} />
                        <StatCard
                          title="文件"
                          value={
                            <span className="text-base">{report.fileName}</span>
                          }
                          delta={new Date(
                            report.createdAt,
                          ).toLocaleDateString()}
                        />
                      </div>

                      {report.digest ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Icon.Sparkles className="text-primary size-4" />
                              {report.digest.headline}
                            </CardTitle>
                            <CardDescription>
                              由宿主模型基于整表的数值汇总生成
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ul className="flex flex-col gap-1.5 text-sm">
                              {report.digest.bullets.map((b, i) => (
                                <li
                                  key={i}
                                  className="text-muted-foreground flex gap-2"
                                >
                                  <span className="text-primary">·</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ) : null}

                      {sheets.length > 0 ? (
                        <Tabs
                          value={active?.name ?? ""}
                          onValueChange={setSheet}
                          className="w-full"
                        >
                          <TabsList>
                            {sheets.map((s) => (
                              <TabsTrigger key={s.name} value={s.name}>
                                {s.name}
                                <Badge variant="secondary" className="ml-1.5">
                                  {s.rowCount}
                                </Badge>
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {sheets.map((s) => (
                            <TabsContent
                              key={s.name}
                              value={s.name}
                              className="flex flex-col gap-3"
                            >
                              {s.columns.some((c) => c.numeric) ? (
                                <div className="border-border text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs">
                                  {s.columns
                                    .filter((c) => c.numeric)
                                    .map((c) => (
                                      <span key={c.header}>
                                        <span className="text-foreground font-medium">
                                          {c.header}
                                        </span>
                                        {" 合计 "}
                                        {c.total}
                                        {" · 均值 "}
                                        {c.avg}
                                        {" · 区间 "}
                                        {c.min}–{c.max}
                                      </span>
                                    ))}
                                </div>
                              ) : null}
                              <DataGrid
                                columns={columns}
                                data={s.rows}
                                pageSize={12}
                                searchPlaceholder="搜索本表…"
                              />
                              {s.rowCount > s.rows.length ? (
                                <p className="text-muted-foreground text-xs">
                                  表格显示前 {s.rows.length}{" "}
                                  行；上面的合计/均值按全部 {s.rowCount}{" "}
                                  行计算。
                                </p>
                              ) : null}
                            </TabsContent>
                          ))}
                        </Tabs>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : undefined
            }
            empty={
              <div className="mx-auto w-full max-w-xl pt-6">
                <FileDropzone onFiles={(fs) => void onFiles(fs)} />
                <div className="text-muted-foreground mt-6 flex flex-col items-center gap-2 text-center text-sm">
                  <IlluEmpty className="w-36" />
                  解析、汇总、摘要都在这台机器上完成，文件不会上传
                </div>
              </div>
            }
            mobileView={hasRecord ? "detail" : "list"}
            onMobileBack={() => setReport(null)}
          />
        </div>
      </div>
    </div>
  );
}
