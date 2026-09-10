import { useCallback, useEffect, useState } from "react";

import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Icon,
  Input,
  ListDetail,
  useApp,
} from "@monkey-mini-app/ui";

import { ItemRow, type Item } from "./ui/item-row";

type Filter = "all" | "active" | "done";
type Stats = { total: number; active: number; done: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "active", label: "先干" },
  { id: "done", label: "已完" },
];

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

// One frosted surface, repeated on purpose: an island is a *shape*, so the same literal is
// shared rather than re-typed (and never composed into `bg-${x}`).
const ISLAND =
  "rounded-3xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-xl";

export default function Ui() {
  const { call } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, done: 0 });
  const [sel, setSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ⭐ key: refresh depends on filter; useCallback avoids an infinite loop
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = (await call("list", { filter })) as {
        items: Item[];
        stats: Stats;
      };
      setItems(Array.isArray(pack?.items) ? pack.items : []);
      setStats(pack?.stats ?? { total: 0, active: 0, done: 0 });
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, [call, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = items.find((i) => i.id === sel) ?? null;

  async function act(job: () => Promise<unknown>) {
    setError(null);
    try {
      await job();
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function add() {
    const title = draft.trim();
    if (!title) return;
    await act(async () => {
      const item = (await call("add", { title })) as Item;
      setDraft("");
      setSel(item.id);
    });
  }

  const now = new Date();
  const weekday = now.toLocaleDateString("zh-CN", { weekday: "long" });
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日`;
  // this week, Monday-first, today marked — the wide island's whole job
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + i);
    return {
      label: WEEK_LABELS[i],
      day: d.getDate(),
      today: d.toDateString() === now.toDateString(),
    };
  });

  return (
    // ⭐ Look: glass-island (references/looks/glass-island.md) — a cluster of frosted widgets
    //   floating on the sky, then the working set. The sky IS the palette: this app ships
    //   theme.css, so `bg-background` is the look's own blue-grey. Do not paint a gradient over
    //   it (that flattens the ground and the slabs stop reading as glass), and do not turn this
    //   into a page-wide tile wall — that is aurora-bento.
    <div className="bg-background relative flex h-full min-h-0 flex-col gap-3 overflow-hidden p-5">
      {/* backdrop-blur needs something behind it: one soft primary wash, token-derived */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "radial-gradient(560px 200px at 18% 0%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 70%)," +
            "radial-gradient(420px 180px at 88% 8%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 72%)",
        }}
      />

      {/* the island cluster: unequal spans, each widget says exactly one thing */}
      {/* The sky has to stay visible around the cluster: an island stretched to every edge is
          just a page with rounded corners. Cap the content and let `--background` frame it.
          6 columns are written out rather than switched on at `md:` — a mini-app lives in a
          panel of whatever width the user dragged it to, and this arrangement *is* the look. */}
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3">
        <div className="grid grid-cols-6 gap-3">
          <div
            className={`${ISLAND} col-span-2 row-span-2 flex flex-col justify-between p-4`}
          >
            <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
              {weekday}
            </p>
            <p className="font-serif text-6xl leading-[0.82] font-medium tracking-tight tabular-nums">
              {now.getDate()}
            </p>
            <p className="text-muted-foreground text-xs">{dateLabel}</p>
          </div>

          <div
            className={`${ISLAND} col-span-4 flex items-center justify-between p-3`}
          >
            {week.map((d) => (
              <span
                key={d.label}
                className={
                  d.today
                    ? "bg-foreground text-background flex size-9 flex-col items-center justify-center rounded-full text-[11px] leading-tight"
                    : "text-muted-foreground flex size-9 flex-col items-center justify-center rounded-full text-[11px] leading-tight"
                }
              >
                <span className="opacity-70">{d.label}</span>
                <span className="tabular-nums">{d.day}</span>
              </span>
            ))}
          </div>

          <div className={`${ISLAND} col-span-2 p-4`}>
            <p className="text-muted-foreground text-[11px]">进行中</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {stats.active}
            </p>
          </div>
          <div className={`${ISLAND} col-span-2 p-4`}>
            <p className="text-muted-foreground text-[11px]">已完</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {stats.done}
            </p>
          </div>
        </div>

        {/* the working set: controls in its own header, ListDetail owns the remaining height */}
        <div className={`${ISLAND} relative flex min-h-0 flex-1 flex-col`}>
          <div className="border-border/60 flex flex-wrap items-center gap-2 border-b p-3">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "default" : "ghost"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => void act(() => call("archive", {}))}
            >
              <Icon.Archive size={16} strokeWidth={2} /> 归档
            </Button>
            <div className="flex w-full gap-2">
              <Input
                value={draft}
                placeholder="加一件，回车"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
              />
              <Button onClick={() => void add()} disabled={!draft.trim()}>
                <Icon.Plus size={16} strokeWidth={2} />
              </Button>
            </div>
            {error ? (
              <p className="text-destructive w-full text-sm">{error}</p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1">
            <ListDetail
              list={
                <ul>
                  {loading && !items.length ? (
                    <li className="text-muted-foreground px-3 py-4 text-sm">
                      加载中…
                    </li>
                  ) : null}
                  {!loading && !items.length ? (
                    <li className="p-4">
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>这一屏还空着</EmptyTitle>
                          <EmptyDescription>
                            上面加一件，它会出现在左边。
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </li>
                  ) : null}
                  {items.map((it) => (
                    <li key={it.id}>
                      <ItemRow
                        item={it}
                        selected={sel === it.id}
                        onSelect={() => setSel(it.id)}
                      />
                    </li>
                  ))}
                </ul>
              }
              detail={
                current ? (
                  <div className="flex flex-col gap-3 p-4">
                    <h2 className="text-lg font-semibold">{current.title}</h2>
                    <p className="text-muted-foreground text-sm">
                      {new Date(current.createdAt).toLocaleString("zh-CN")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void act(() => call("toggle", { id: current.id }))
                        }
                      >
                        {current.done ? "标为未完" : "标为完成"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void act(async () => {
                            await call("remove", { id: current.id });
                            setSel(null);
                          })
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ) : undefined
              }
              empty={
                <p className="text-muted-foreground p-4 text-sm">
                  点左边一条，这边打开。
                </p>
              }
              mobileView={current ? "detail" : "list"}
              onMobileBack={() => setSel(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
