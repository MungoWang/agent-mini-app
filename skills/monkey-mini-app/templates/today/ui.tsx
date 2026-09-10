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
      const pack = (await call("list", { filter })) as { items: Item[]; stats: Stats };
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

  return (
    // ⭐ Look: glass-island (references/looks/glass-island.md) — a poster on the sky plus two
    //   frosted slabs, NOT a 2D tile wall. The sky IS the palette: this app ships theme.css, so
    //   `bg-background` is the look's own blue-grey. Do not paint a gradient over it toward
    //   `--muted` — that flattens the ground and the 70% slabs stop reading as glass.
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-background p-5">
      {/* Frost needs something to blur. A flat gradient behind the slabs reads as "pale box";
          one soft primary wash (token-derived, not a hex) is what makes `backdrop-blur` show. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "radial-gradient(560px 200px at 18% 0%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 70%)," +
            "radial-gradient(420px 180px at 88% 8%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 72%)",
        }}
      />
      {/* poster: one oversized numeral, everything else is its caption */}
      <div className="relative flex items-end gap-4 px-1 pt-2 pb-1">
        <p className="font-serif text-7xl leading-[0.8] font-medium tracking-tight tabular-nums">
          {now.getDate()}
        </p>
        <div className="pb-1">
          <p className="text-sm tracking-wide">{weekday}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{dateLabel}</p>
        </div>
        <p className="text-muted-foreground ml-auto pb-2 text-xs tabular-nums">
          {stats.active} 件进行中 · {stats.done} 已完
        </p>
      </div>
      <div className="relative rounded-3xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "ghost"} onClick={() => setFilter(f.id)}>
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void act(() => call("archive", {}))}>
            <Icon.Archive size={16} strokeWidth={2} /> 归档
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
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
        {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-xl">
          <ListDetail
            list={
              <ul>
                {loading && !items.length ? (
                  <li className="text-muted-foreground px-3 py-4 text-sm">加载中…</li>
                ) : null}
                {!loading && !items.length ? (
                  <li className="p-4">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>这一屏还空着</EmptyTitle>
                        <EmptyDescription>上面加一件，它会出现在左边。</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </li>
                ) : null}
                {items.map((it) => (
                  <li key={it.id}>
                    <ItemRow item={it} selected={sel === it.id} onSelect={() => setSel(it.id)} />
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
                    <Button size="sm" variant="outline" onClick={() => void act(() => call("toggle", { id: current.id }))}>
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
            empty={<p className="text-muted-foreground p-4 text-sm">点左边一条，这边打开。</p>}
            mobileView={current ? "detail" : "list"}
            onMobileBack={() => setSel(null)}
          />
        </div>
      </div>
    </div>
  );
}
