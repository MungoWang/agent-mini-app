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

/*
 * Real liquid glass, not frosted glass: the background is *displaced*, so the pane bends what is
 * behind it. `backdrop-filter` accepts an SVG filter alongside the functions (verified in
 * Chromium: `blur(2px) url(#id)` survives as written) — `LiquidDefs` below carries that filter.
 *
 * A displacement map can only bend structure that exists. Over a smooth gradient it renders
 * nothing at all, which is why the sky carries grain and tight bokeh — see the wash layer.
 *
 * The refraction is gentle on purpose (`scale="45"`, `yChannelSelector="B"`): push it to
 * `scale="130"` / `yChannelSelector="G"` and the text inside the pane starts wobbling — water, not glass.
 *
 * Non-Chromium engines drop `url()` here, so fall back to the old frost rather than a plain box.
 */
const REFRACTS =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("backdrop-filter", "blur(2px) url(#mma-liquid)");

const GLASS = {
  // Radius lives on the style, not a class: the old `ISLAND = "rounded-3xl"` was defined and
  // never applied, which is why the panes looked hard-edged. Token so theme.css owns the size.
  borderRadius: "var(--radius)",
  backgroundColor: "color-mix(in oklch, var(--card) 14%, transparent)",
  boxShadow:
    "inset 0 1px 0 color-mix(in oklch, var(--card) 60%, transparent)," +
    "inset 0 -1px 0 color-mix(in oklch, var(--card) 22%, transparent)," +
    "inset 0 0 24px color-mix(in oklch, var(--card) 14%, transparent)," +
    "0 14px 36px -10px var(--shadow)",
  border: "1px solid color-mix(in oklch, var(--card) 28%, transparent)",
  backdropFilter: REFRACTS
    ? "blur(2px) saturate(160%) url(#mma-liquid)"
    : "blur(18px) saturate(200%) brightness(1.08)",
  WebkitBackdropFilter: REFRACTS
    ? "blur(2px) saturate(160%)"
    : "blur(18px) saturate(200%) brightness(1.08)",
} as const;

/** Soft card for the working set — not liquid. A full-bleed displaced pane eats the sky
 *  and is why the facade never matched the floating-pill prototype. */
const WORK = {
  borderRadius: "var(--radius)",
  backgroundColor: "color-mix(in oklch, var(--card) 78%, transparent)",
  boxShadow: "0 10px 28px -12px var(--shadow)",
  border: "1px solid color-mix(in oklch, var(--card) 40%, transparent)",
  backdropFilter: "blur(12px) saturate(140%)",
  WebkitBackdropFilter: "blur(12px) saturate(140%)",
} as const;

/**
 * The filter lives in the app's own document — `backdrop-filter: url(#id)` resolves against the
 * same DOM tree, so a mini-app carries its liquid glass with it. Hidden, zero-size, off-screen:
 * a `width=0` svg still exposes its `<defs>` to the document.
 */
function LiquidDefs() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed -left-[9999px] top-0 h-0 w-0"
    >
      <defs>
        {/* noise → blur (so the bend is smooth, not fuzzy) → displace the backdrop pixels */}
        <filter
          id="mma-liquid"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.004"
            numOctaves="2"
            seed="3"
            result="n"
          />
          <feGaussianBlur in="n" stdDeviation="1.8" result="m" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="m"
            scale="45"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
        {/* fine grain for the sky: the lens needs high-frequency detail behind it to read at all */}
        <filter id="mma-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}

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
      <LiquidDefs />
      {/* The lens can only bend what is there: soft pools for hue depth, tight bokeh and grain for
          something with edges. Token-derived `color-mix()` on --primary / --card / --foreground, so a
          different ThemePop choice or dark mode keeps working and the app ships no colour literal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // Floating haze: large soft orbs in white / mist-blue, low contrast. Light mode is
          // haze-grey + white + a whisper of blue — not a saturated sky. Still enough structure
          // (orb edges + grain) for the liquid lens to bend.
          // Floating orbs must read against the haze ground: higher alpha, clearer edges,
          // white + soft primary only (still not a saturated sky).
          background:
            "radial-gradient(55% 58% at 10% -4%, color-mix(in oklch, var(--card) 92%, transparent), transparent 68%)," +
            "radial-gradient(48% 52% at 92% 4%, color-mix(in oklch, var(--primary) 38%, transparent), transparent 66%)," +
            "radial-gradient(50% 45% at 72% 88%, color-mix(in oklch, var(--card) 80%, transparent), transparent 64%)," +
            "radial-gradient(42% 48% at 12% 82%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 64%)," +
            "radial-gradient(160px 160px at 32% 28%, color-mix(in oklch, var(--card) 95%, transparent), transparent 70%)," +
            "radial-gradient(130px 130px at 78% 36%, color-mix(in oklch, var(--primary) 32%, transparent), transparent 70%)," +
            "radial-gradient(140px 140px at 52% 62%, color-mix(in oklch, var(--card) 88%, transparent), transparent 68%)," +
            "radial-gradient(110px 110px at 22% 58%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 70%)",
        }}
      />
      {/* grain: finest structure; opacity high enough that the bend is legible on a mid sky */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.2]"
      >
        <rect width="100%" height="100%" filter="url(#mma-grain)" />
      </svg>

      {/* the island cluster: unequal spans, each widget says exactly one thing */}
      {/* The sky has to stay visible around the cluster: an island stretched to every edge is
          just a page with rounded corners. Cap the content and let `--background` frame it.
          6 columns are written out rather than switched on at `md:` — a mini-app lives in a
          panel of whatever width the user dragged it to, and this arrangement *is* the look. */}
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3">
        <div className="grid grid-cols-6 gap-3">
          <div
            style={GLASS}
            className="col-span-2 row-span-2 flex flex-col justify-between p-4"
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
            style={GLASS}
            className="col-span-4 flex items-center justify-between p-3"
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

          <div style={GLASS} className="col-span-2 p-4">
            <p className="text-muted-foreground text-[11px]">进行中</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {stats.active}
            </p>
          </div>
          <div style={GLASS} className="col-span-2 p-4">
            <p className="text-muted-foreground text-[11px]">已完</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {stats.done}
            </p>
          </div>
        </div>

        {/* the working set: controls in its own header, ListDetail owns the remaining height */}
        {/* Working set is a soft card, not liquid glass — wall-to-wall displacement ate the sky
            and is why the facade never matched the floating-pill prototype. */}
        <div style={WORK} className="relative flex min-h-0 flex-1 flex-col">
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
