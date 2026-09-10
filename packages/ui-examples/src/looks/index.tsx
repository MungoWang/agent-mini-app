/**
 * @group looks
 * @title Look catalog
 * @scenario Live fixtures for the eight Looks. Skill copies catalog.json as markdown, not this TSX.
 */
import * as React from "react";

import { Badge, Button, Icon, ListDetail, Reveal, Separator, Terminal } from "@monkey-mini-app/ui";

export function GlassIslandLook() {
  return (
    <div className="flex h-full min-h-0 flex-col justify-between bg-linear-to-b from-muted-foreground/30 to-muted p-6 text-foreground">
      <Reveal>
        <p className="text-sm tracking-wide text-muted-foreground">星期五 · 微雨</p>
        <p className="mt-1 font-serif text-6xl leading-none tracking-tight">68°</p>
        <p className="text-muted-foreground mt-2 text-sm">8 月 28 日 · L 66° H 76°</p>
      </Reveal>
      <div className="flex flex-col gap-2">
        <div className="rounded-3xl border border-border/50 bg-card/40 px-4 py-3 backdrop-blur-xl">
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
        <div className="rounded-3xl border border-border/50 bg-card/40 flex justify-between px-4 py-3 text-sm backdrop-blur-xl">
          <span>工作 10:00</span>
          <span>放学 16:50</span>
        </div>
      </div>
    </div>
  );
}

export function AuroraBentoLook() {
  const tile = "rounded-lg bg-card p-3 text-sm overflow-hidden";
  return (
    <div className="bg-muted grid h-full min-h-0 grid-cols-6 grid-rows-3 gap-1.5 p-1.5">
      <div className="bg-foreground text-background col-span-2 row-span-2 rounded-lg p-4">
        <p className="text-xs opacity-70">高效生活</p>
        <p className="mt-2 text-xl font-medium">从有序开始</p>
      </div>
      <div className={`${tile} col-span-2`}>
        日历
        <b className="mt-1 block text-lg">28</b>
      </div>
      <div className={`${tile} col-span-2`}>
        专注
        <b className="mt-1 block text-lg">3h 24</b>
      </div>
      <div className={`${tile} col-span-2 bg-primary/10`}>
        任务
        <b className="mt-1 block text-lg">5</b>
      </div>
      <div className={`${tile} col-span-2`}>
        笔记
        <b className="mt-1 block text-lg">12</b>
      </div>
      <div className={`${tile} col-span-3`}>+12k 本周完成</div>
      <div className={`${tile} col-span-3 bg-primary/20`}>小小的进步</div>
    </div>
  );
}

export function DeskSplitLook() {
  const [sel, setSel] = React.useState("a");
  const rows = [
    { id: "a", title: "核对 Q3 回款", tag: "财务" },
    { id: "b", title: "华东线索跟进", tag: "销售" },
    { id: "c", title: "导出对账单", tag: "开发" },
  ];
  const cur = rows.find((r) => r.id === sel)!;
  return (
    <div className="h-full min-h-0">
      <ListDetail
        toolbar={
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <span className="text-sm font-medium">全部 {rows.length}</span>
            <Badge variant="outline">筛选</Badge>
          </div>
        }
        list={
          <ul>
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`flex w-full justify-between px-3 py-2 text-left text-sm ${sel === r.id ? "bg-muted" : ""}`}
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
          <div className="p-4">
            <Reveal>
              <h3 className="text-base font-semibold">{cur.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">今天 09:30</p>
              <Button className="mt-4" size="sm">
                打开
              </Button>
            </Reveal>
          </div>
        }
      />
    </div>
  );
}

export function EditorialLook() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Vol.24 · Weekly</p>
      <Reveal>
        <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight">
          记事的本质，是让人愿意<span className="text-primary">回头再看</span>
        </h2>
      </Reveal>
      <Separator className="my-6" />
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        衬线大标题、黑白灰加一枚强调色、刊头线。没有卡片墙。
      </p>
      <div className="mt-6 flex gap-2">
        <Badge variant="outline">01 归档</Badge>
        <Badge variant="outline">02 置顶</Badge>
        <Badge variant="outline">03 清理</Badge>
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
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-background p-6">
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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2 font-mono text-xs">
        <Icon.Circle className="size-2 fill-red-400 text-red-400" />
        <Icon.Circle className="size-2 fill-amber-400 text-amber-400" />
        <Icon.Circle className="size-2 fill-emerald-400 text-emerald-400" />
        deploy --watch
      </div>
      <div className="min-h-0 flex-1">
        <Terminal
          lines={[
            "12:04:01  ok    compile ui.tsx",
            "12:04:02  run   ctx.agent streamTo",
            "12:04:08  warn  retry llm timeout",
            "12:04:11  ok    push progress 4/7",
          ]}
        />
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
