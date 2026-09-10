/**
 * @group looks
 * @title Look catalog
 * @scenario Live fixtures for the eight Looks. Skill copies catalog.json as markdown, not this TSX.
 */
import * as React from "react";

import { Badge, Button, Icon, ListDetail, Reveal, Separator, Terminal } from "@monkey-mini-app/ui";

import { useLookPalette } from "./palette";

/**
 * The same three glass layers `templates/today` uses, in one place so the preview cannot drift
 * from the facade: translucent fill, elevation shadow, bright inner top edge. Inline because
 * Tailwind drops the extra inset layers of an arbitrary `shadow-[…]`.
 */
const GLASS = {
  backgroundColor: "color-mix(in oklch, var(--card) 26%, transparent)",
  backgroundImage:
    "linear-gradient(to bottom," +
    " color-mix(in oklch, var(--card) 42%, transparent) 0%," +
    " color-mix(in oklch, var(--card) 14%, transparent) 32%," +
    " transparent 70%)",
  boxShadow:
    "inset 0 1.5px 0 color-mix(in oklch, var(--card) 96%, transparent)," +
    "inset 0 -1px 0 color-mix(in oklch, var(--card) 38%, transparent)," +
    "0 2px 6px -2px color-mix(in oklch, var(--foreground) 30%, transparent)," +
    "0 20px 42px -18px var(--shadow)",
  borderColor: "color-mix(in oklch, var(--card) 34%, transparent)",
  backdropFilter: "blur(18px) saturate(200%) brightness(1.08)",
  WebkitBackdropFilter: "blur(18px) saturate(200%) brightness(1.08)",
} as const;

// Mirrors templates/sheets: walnut grain + one amber lamp pool + vignette; the papers are
// cream in both modes (lamp-lit paper on a dark desk is the look, dark papers are mud).
const DESK =
  "repeating-linear-gradient(90deg, color-mix(in oklch, var(--foreground) 5%, transparent) 0 2px, transparent 2px 26px)," +
  "repeating-linear-gradient(90deg, color-mix(in oklch, var(--foreground) 8%, transparent) 0 1px, transparent 1px 96px)," +
  "radial-gradient(620px 320px at 12% -12%, color-mix(in oklch, var(--primary) 42%, transparent), transparent 70%)," +
  "radial-gradient(560px 620px at 64% 116%, color-mix(in oklch, var(--foreground) 16%, transparent), transparent 72%)";
const PAPER = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
  boxShadow:
    "0 1px 2px color-mix(in oklch, var(--foreground) 24%, transparent)," +
    "0 18px 44px -18px var(--shadow)," +
    "inset 0 1px 0 color-mix(in oklch, var(--card) 72%, transparent)",
  borderColor: "color-mix(in oklch, var(--foreground) 12%, transparent)",
} as const;

// Mirrors templates/board: the aurora is three hue pools mixed out of the palette's primary
// (toward the ink for depth, toward destructive for the warm drift); tiles stay OPAQUE and
// raised — glass is glass-island's job.
const AURORA =
  "radial-gradient(42% 40% at 10% 2%, color-mix(in oklch, var(--primary) 92%, transparent), transparent 58%)," +
  "radial-gradient(38% 44% at 90% 10%, color-mix(in oklch, var(--primary) 62%, var(--foreground)), transparent 60%)," +
  "radial-gradient(52% 46% at 42% 104%, color-mix(in oklch, var(--primary) 58%, var(--destructive)), transparent 62%)";
const RAISED = {
  boxShadow:
    "0 1px 2px color-mix(in oklch, var(--foreground) 14%, transparent)," + "0 14px 30px -14px var(--shadow)",
} as const;

export function GlassIslandLook() {
  const palette = useLookPalette("glass-island");
  return (
    // Mirrors templates/today: the sky is `bg-background` (the look ships its own theme.css),
    // one soft primary wash so the frost has something to blur, two slabs on top.
    <div
      style={palette}
      className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden bg-background p-6 text-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(620px 260px at 16% -6%, color-mix(in oklch, var(--primary) 38%, transparent), transparent 68%)," +
            "radial-gradient(460px 220px at 92% 6%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 70%)," +
            "radial-gradient(520px 300px at 50% 108%, color-mix(in oklch, var(--foreground) 12%, transparent), transparent 70%)",
        }}
      />
      <Reveal>
        <p className="text-sm tracking-wide text-muted-foreground">星期五 · 微雨</p>
        <p className="mt-1 font-serif text-6xl leading-none tracking-tight">68°</p>
        <p className="text-muted-foreground mt-2 text-sm">8 月 28 日 · L 66° H 76°</p>
      </Reveal>
      {/* capped and centred: an island stretched to every edge is just a page with rounded corners */}
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-2">
        <div style={GLASS} className="rounded-3xl border px-4 py-3">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>一 24</span>
            <span>二 25</span>
            <span>三 26</span>
            <span>四 27</span>
            <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full">
              28
            </span>
            <span>六 29</span>
            <span>日 30</span>
          </div>
        </div>
        <div style={GLASS} className="flex justify-between rounded-3xl border px-4 py-3 text-sm">
          <span>工作 10:00</span>
          <span>放学 16:50</span>
        </div>
      </div>
    </div>
  );
}

export function AuroraBentoLook() {
  const palette = useLookPalette("aurora-bento");
  const tile = "bg-card relative rounded-2xl p-3 text-sm overflow-hidden";
  return (
    // Mirrors templates/board: an aurora field with opaque raised tiles on top. The ground is
    // the look — `bg-muted` here would just be an admin dashboard.
    <div
      style={palette}
      className="bg-background relative grid h-full min-h-0 grid-cols-6 grid-rows-3 gap-1.5 overflow-hidden p-1.5 text-foreground"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: AURORA }} />
      <div
        className="bg-foreground text-background relative col-span-2 row-span-2 rounded-2xl p-4"
        style={RAISED}
      >
        <p className="text-xs opacity-70">高效生活</p>
        <p className="mt-2 text-xl font-medium">从有序开始</p>
      </div>
      <div className={`${tile} col-span-2`} style={RAISED}>
        日历
        <b className="mt-1 block text-lg">28</b>
      </div>
      <div className={`${tile} col-span-2`} style={RAISED}>
        专注
        <b className="mt-1 block text-lg">3h 24</b>
      </div>
      <div className={`${tile} col-span-2`} style={RAISED}>
        任务
        <b className="mt-1 block text-lg">5</b>
      </div>
      <div className={`${tile} col-span-2`} style={RAISED}>
        笔记
        <b className="mt-1 block text-lg">12</b>
      </div>
      <div className={`${tile} col-span-3`} style={RAISED}>
        +12k 本周完成
      </div>
      <div className={`${tile} col-span-3`} style={RAISED}>
        小小的进步
      </div>
    </div>
  );
}

export function DeskSplitLook() {
  const palette = useLookPalette("desk-split");
  const [sel, setSel] = React.useState("a");
  const rows = [
    { id: "a", title: "核对 Q3 回款", tag: "财务" },
    { id: "b", title: "华东线索跟进", tag: "销售" },
    { id: "c", title: "导出对账单", tag: "开发" },
  ];
  const cur = rows.find((r) => r.id === sel)!;
  return (
    // Mirrors templates/sheets: the desk is the palette's walnut `bg-background`, the papers
    // (`bg-card`) stay cream in both modes — lamp-lit paper on a dark desk IS the look.
    <div style={palette} className="bg-background relative flex h-full min-h-0 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: DESK }} />
      <header
        style={PAPER}
        className="border-b relative mx-4 mt-3 flex items-center gap-2 rounded-t-2xl border px-4 py-2.5"
      >
        <span className="font-serif text-base font-semibold tracking-tight">全部 {rows.length}</span>
        <Badge variant="outline">筛选</Badge>
        <Badge variant="outline">本机</Badge>
      </header>
      <div className="relative mx-4 mb-4 flex min-h-0 flex-1">
        <div
          style={PAPER}
          className="flex h-full min-h-0 w-full overflow-hidden rounded-b-2xl border border-t-0"
        >
          <ListDetail
            className="flex-1"
            toolbar={
              <div className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2 text-xs font-medium tracking-wide uppercase">
                <Icon.List className="size-3.5" />
                待办
              </div>
            }
            list={
              <ul className="divide-border divide-y">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`flex w-full justify-between px-3 py-2 text-left text-sm ${sel === r.id ? "bg-accent" : ""}`}
                      onClick={() => setSel(r.id)}
                    >
                      <span>{r.title}</span>
                      <span className="text-muted-foreground">{r.tag}</span>
                    </button>
                  </li>
                ))}
              </ul>
            }
            detail={
              <div className="flex flex-col gap-3 p-4">
                <Reveal>
                  <h3 className="font-serif text-lg font-semibold tracking-tight">{cur.title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">今天 09:30 · {cur.tag}</p>
                </Reveal>
                <div className="grid grid-cols-3 gap-2">
                  {["¥128k 应收", "¥96k 已回款", "12 账单"].map((k) => (
                    <div key={k} className="border-border rounded-lg border px-2 py-1.5 text-xs tabular-nums">
                      {k}
                    </div>
                  ))}
                </div>
                <Button size="sm" className="self-start">
                  打开
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

export function EditorialLook() {
  const palette = useLookPalette("editorial");
  return (
    // Mirrors templates/radar: paper and ink ARE the look — under the default palette this is
    // just text on white. Kicker → serif display → hairline → first-letter paragraph.
    <div style={palette} className="bg-background h-full min-h-0 overflow-y-auto text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Vol.24 · Weekly</p>
        <Reveal>
          <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight">
            记事的本质，是让人愿意<span className="text-primary">回头再看</span>
          </h2>
        </Reveal>
        <Separator className="my-6" />
        <p className="max-w-xl text-sm leading-relaxed first-letter:text-primary first-letter:font-serif first-letter:float-left first-letter:mt-0.5 first-letter:mr-1 first-letter:text-3xl first-letter:font-bold">
          衬线大标题、纸与墨、刊头细线、一枚强调色。没有卡片墙，也没有渐变地面——那是极光便当的事。
        </p>
        <div className="mt-6 flex gap-2">
          <Badge variant="outline">01 归档</Badge>
          <Badge variant="outline">02 置顶</Badge>
          <Badge variant="outline">03 清理</Badge>
        </div>
      </div>
    </div>
  );
}

export function TapeLook() {
  const rows = [
    ["api-gateway", "12k/s", "82ms", "ok"],
    ["worker-queue", "400/s", "410ms", "warn"],
    ["auth", "3k/s", "44ms", "ok"],
  ];
  return (
    <div className="h-full min-h-0 bg-background font-mono">
      <div className="grid grid-cols-4 divide-x divide-border">
        {[
          ["Load", "0.42"],
          ["p95", "82"],
          ["Mem", "61%"],
          ["Fail", "2"],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-5">
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase">{k}</div>
            <div
              className={`mt-1 text-3xl font-medium tracking-tight tabular-nums ${k === "Fail" ? "text-destructive" : ""}`}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t">
        {rows.map((r) => (
          <div
            key={r[0]}
            className="text-muted-foreground grid grid-cols-[1.4fr_70px_70px_50px] gap-2 border-b px-4 py-2 text-xs"
          >
            <span className="text-foreground">{r[0]}</span>
            <span>{r[1]}</span>
            <span>{r[2]}</span>
            <span className={r[3] === "warn" ? "text-destructive" : "text-emerald-600"}>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VoidLook() {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center px-8 py-10">
      <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Mindflow</p>
      <h2 className="mt-4 max-w-[10ch] text-4xl font-medium tracking-tight">让思考更进一步</h2>
      <div className="from-foreground mt-6 h-px w-28 bg-linear-to-r to-transparent" />
      <p className="text-muted-foreground mt-5 flex gap-6 text-xs">
        <span>1M+ 在用</span>
        <span>99% 提升</span>
        <span>24/7</span>
      </p>
    </div>
  );
}

export function SignageLook() {
  const palette = useLookPalette("signage");
  return (
    <div style={palette} className="relative h-full min-h-0 overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(420px 180px at 90% 10%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 62%)",
        }}
      />
      <div className="relative">
        <p className="text-primary text-[11px] font-semibold tracking-[0.32em]">NEONGRID</p>
        <h2 className="mt-3 text-4xl leading-[0.95] font-bold tracking-tight">
          连接<span className="text-primary">下一个</span>
          <br />
          现实
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[36ch] text-sm">技术让更多可能发生。</p>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {["01 People / 人", "02 Technology / 技术", "03 Cities / 城市"].map((t) => (
            <div key={t} className="border-border border-t pt-2 text-xs tracking-wide">
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TerminalLook() {
  const palette = useLookPalette("terminal");
  return (
    // Mirrors templates/runner: token well (not the kit's hard zinc), phosphor glow,
    // scanlines + vignette on an overlay, squared corners.
    <div
      style={palette}
      className="bg-background flex h-full min-h-0 flex-col font-mono text-xs text-foreground"
    >
      <div className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        deploy --watch
      </div>
      <div className="min-h-0 flex-1 p-3">
        <div
          className="border-border relative h-full min-h-0 overflow-hidden rounded-lg border"
          style={{ textShadow: "0 0 6px color-mix(in oklch, var(--primary) 65%, transparent)" }}
        >
          <Terminal
            className="border-border bg-card text-card-foreground h-full rounded-lg"
            lines={[
              "12:04:01  ok    compile ui.tsx",
              "12:04:02  run   ctx.agent streamTo",
              "12:04:08  warn  retry llm timeout",
              "12:04:11  ok    push progress 4/7",
              "$ █",
            ]}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, color-mix(in oklch, var(--foreground) 7%, transparent) 0 1px, transparent 1px 3px)," +
                "radial-gradient(120% 90% at 50% 40%, transparent 62%, var(--shadow))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const LOOKS = [
  { id: "glass-island", title: "Glass Island", zh: "玻璃岛屿", View: GlassIslandLook },
  { id: "aurora-bento", title: "Aurora Bento", zh: "极光便当", View: AuroraBentoLook },
  { id: "desk-split", title: "Desk Split", zh: "精致分栏", View: DeskSplitLook },
  { id: "editorial", title: "Editorial", zh: "编辑排版", View: EditorialLook },
  { id: "tape", title: "Tape", zh: "行情带", View: TapeLook },
  { id: "void", title: "Void", zh: "黑空", View: VoidLook },
  { id: "signage", title: "Signage", zh: "霓虹招牌", View: SignageLook },
  { id: "terminal", title: "Terminal", zh: "终端等宽", View: TerminalLook },
] as const;
