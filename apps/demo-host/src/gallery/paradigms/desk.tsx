import * as React from "react"
import {
  CalendarDays,
  Check,
  Circle,
  Coffee,
  Pause,
  Play,
  Plus,
  Timer,
} from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { Progress } from "@monkey-mini-app/ui/components/progress"
import { Tabs, TabsList, TabsTrigger } from "@monkey-mini-app/ui/components/tabs"
import { StyleHeader, Reveal, useCountUp } from "./shared"

/**
 * CRM/ERP 商业仪表盘（Stripe / Notion 商业版）。
 * 顶部 Metrics 大数字卡 + 纯白浅灰 + 细边框圆润微阴影 +
 * 全黑白灰，彩色只用于状态标签与头像。字重与字号区分层级。
 */

type Task = { id: string; title: string; time: string; done: boolean; tag: string; hours: number }

const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "核对 Q3 回款账单", time: "09:30", done: true, tag: "财务", hours: 0.5 },
  { id: "t2", title: "销售线索跟进（华东）", time: "11:00", done: false, tag: "销售", hours: 1 },
  { id: "t3", title: "修复对账单导出", time: "14:00", done: false, tag: "开发", hours: 2 },
  { id: "t4", title: "客户回访纪要归档", time: "16:30", done: false, tag: "客服", hours: 0 },
]

const WEEKLY = [
  ["一", 3.5],
  ["二", 4.2],
  ["三", 5.1],
  ["四", 2.8],
  ["五", 4.6],
  ["六", 1.2],
  ["日", 0.8],
] as const

const EVENTS: Record<number, string[]> = {
  8: ["财务对账 10:00", "周会 15:00"],
  12: ["月度复盘 15:00"],
  19: ["账单日", "销售周报"],
  26: ["工时结算", "客户回访"],
}

const CARD =
  "rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)]"

const TAG_STYLE: Record<string, string> = {
  "财务": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "销售": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "开发": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "客服": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

const TREND = {
  up: [4, 6, 5, 8, 7, 10, 9, 12, 11, 14],
  down: [12, 11, 12, 10, 11, 9, 10, 8, 9, 7],
}

function Metric({
  label,
  value,
  delta,
  up,
  delay,
  trend,
}: {
  label: string
  value: number
  delta: string
  up: boolean
  delay: number
  trend: number[]
}) {
  const n = useCountUp(value)
  const max = Math.max(...trend)
  const pts = trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${28 - (v / max) * 24}`).join(" ")
  return (
    <Reveal delay={delay}>
      <div className={CARD + " p-4"}>
        <div className="text-muted-foreground text-xs font-medium">{label}</div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] leading-none font-bold tracking-tight tabular-nums">{n}</span>
              <span
                className={
                  "text-xs font-semibold " + (up ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")
                }
              >
                {delta}
              </span>
            </div>
          </div>
          {/* 迷你趋势线（细灰线 + 末端点） */}
          <svg viewBox="0 0 100 28" className="h-7 w-16 shrink-0" preserveAspectRatio="none">
            <polyline
              points={pts}
              fill="none"
              stroke={up ? "var(--color-emerald-500, oklch(0.627 0.17 149.2))" : "var(--color-amber-500, oklch(0.769 0.188 70.08))"}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            <circle
              cx="100"
              cy={pts.split(" ").at(-1).split(",")[1]}
              r="2.2"
              fill={up ? "oklch(0.627 0.17 149.2)" : "oklch(0.769 0.188 70.08)"}
            />
          </svg>
        </div>
      </div>
    </Reveal>
  )
}

export function DeskParadigm() {
  const [tasks, setTasks] = React.useState<Task[]>(INITIAL_TASKS)
  const [focusing, setFocusing] = React.useState(false)
  const [focusSec, setFocusSec] = React.useState(2 * 3600 + 47 * 60)
  const [selectedDay, setSelectedDay] = React.useState(26)
  const [period, setPeriod] = React.useState<"week" | "month">("week")

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const addHours = (id: string, h: number) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, hours: +(t.hours + h).toFixed(1) } : t)))

  const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0)
  const doneCount = tasks.filter((t) => t.done).length
  const periodData = period === "week" ? WEEKLY : WEEKLY.map(([d, v]) => [d, Math.round(v * 4.3)] as const)

  const fmt = (s: number) =>
    `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`

  return (
    <div>
      <StyleHeader
        tag="CRM / ERP"
        name="商业仪表盘"
        desc="Metrics 大数字卡 · 纯白浅灰 · 细边框微阴影 · 字重区分层级"
      />

      {/* 顶部 Metrics 大数字 */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="本月营收" value={128400} delta="+12.4%" up delay={0} trend={TREND.up} />
        <Metric label="活跃客户" value={3206} delta="+8.1%" up delay={60} trend={TREND.up} />
        <Metric label="待回款" value={862} delta="-5.2%" up={false} delay={120} trend={TREND.down} />
        <Metric label="工单解决率" value={94.2} delta="+1.3%" up delay={180} trend={TREND.up} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* 左主区：任务 + 工时统计 */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Reveal delay={80}>
            <div className={CARD + " p-5"}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">今日任务</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {doneCount}/{tasks.length} 完成 · 已记工时 <b className="tabular-nums">{totalHours}h</b>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="size-3.5" /> 新建任务
                </Button>
              </div>
              <div className="space-y-0.5">
                {tasks.map((item, i) => (
                  <Reveal key={item.id} delay={120 + i * 60}>
                    <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
                      <button
                        type="button"
                        aria-label="toggle"
                        onClick={() => toggleTask(item.id)}
                        className={item.done ? "text-emerald-500" : "text-muted-foreground/50 hover:text-foreground"}
                      >
                        {item.done ? <Check className="size-4" /> : <Circle className="size-4" />}
                      </button>
                      <span className={"min-w-0 flex-1 truncate text-[13px] font-medium " + (item.done ? "text-muted-foreground line-through" : "")}>
                        {item.title}
                      </span>
                      <span className={"hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline " + TAG_STYLE[item.tag]}>
                        {item.tag}
                      </span>
                      <span className="text-muted-foreground/60 w-8 text-right text-[11px] tabular-nums">{item.time}</span>
                      <span className="text-muted-foreground w-8 text-right text-[11px] tabular-nums">{item.hours}h</span>
                      <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="add 0.5h"
                          className="bg-muted text-muted-foreground rounded px-1 text-[10px] hover:text-foreground"
                          onClick={() => addHours(item.id, 0.5)}
                        >
                          +0.5h
                        </button>
                        <button
                          type="button"
                          aria-label="add 1h"
                          className="bg-muted text-muted-foreground rounded px-1 text-[10px] hover:text-foreground"
                          onClick={() => addHours(item.id, 1)}
                        >
                          +1h
                        </button>
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className={CARD + " p-5"}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">工时统计</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">按日汇总 · 与回款关联</div>
                </div>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as "week" | "month")} className="w-auto">
                  <TabsList className="h-7">
                    <TabsTrigger value="week" className="px-2 text-xs">周</TabsTrigger>
                    <TabsTrigger value="month" className="px-2 text-xs">月</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {periodData.map(([d, v], i) => (
                  <div key={String(d)} className="group flex flex-1 flex-col items-center gap-1">
                    <span className="text-muted-foreground text-[9px] opacity-0 transition-opacity group-hover:opacity-100 tabular-nums">
                      {v}h
                    </span>
                    <div
                      className={
                        "w-full rounded-t-sm bg-foreground/80 transition-colors " +
                        (i === 2 ? "bg-primary" : "group-hover:bg-foreground")
                      }
                      style={{ height: `${Math.min(100, (v / 6) * 100)}%` }}
                    />
                    <span className="text-muted-foreground/60 text-[10px]">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* 右栏：日历事件 + 专注 + 头像组 */}
        <div className="flex flex-col gap-3">
          <Reveal delay={100}>
            <div className={CARD + " p-5"}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">日历</div>
                <CalendarDays className="text-muted-foreground size-4" />
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                  <span key={d} className="text-muted-foreground/60 pb-1 text-[10px]">
                    {d}
                  </span>
                ))}
                {Array.from({ length: 28 }, (_, i) => {
                  const day = i + 1
                  const today = day === 26
                  const hasEvent = EVENTS[day]
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={
                        "relative flex size-7 items-center justify-center rounded-full text-xs transition-all " +
                        (day === selectedDay
                          ? "bg-foreground font-semibold text-background"
                          : today
                            ? "font-semibold ring-1 ring-foreground/40"
                            : "hover:bg-muted/60")
                      }
                    >
                      {day}
                      {hasEvent && day !== selectedDay ? (
                        <span className="bg-foreground/50 absolute bottom-0.5 size-1 rounded-full" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className={CARD + " flex-1 p-5"}>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-sm font-semibold">8 月 26 日 · 事件</div>
                <Badge variant="secondary" className="text-[10px]">
                  记工时
                </Badge>
              </div>
              <div className="space-y-1.5">
                {(EVENTS[selectedDay] ?? ["这一天没有安排"]).map((ev, i) => (
                  <div key={ev} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
                    <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded text-[10px]">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px]">{ev}</span>
                    <button
                      type="button"
                      aria-label="log 0.5h"
                      className="bg-muted text-muted-foreground rounded px-1.5 text-[10px] opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      +0.5h
                    </button>
                  </div>
                ))}
                <div className="border-t pt-2">
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>当日合计</span>
                    <span className="font-medium tabular-nums">
                      {(EVENTS[selectedDay] ?? []).length * 0.5}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className={CARD + " flex items-center justify-between p-4"}>
              <div className="flex -space-x-1.5">
                {[
                  ["王小明", "bg-sky-500"],
                  ["李思", "bg-violet-500"],
                  ["陈默", "bg-emerald-500"],
                  ["赵青", "bg-amber-500"],
                ].map(([name, color]) => (
                  <span
                    key={name}
                    className={
                      "flex size-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold text-white " + color
                    }
                  >
                    {String(name).slice(0, 1)}
                  </span>
                ))}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{fmt(focusSec)}</div>
                <div className="text-muted-foreground text-[10px]">今日专注</div>
              </div>
              <Button
                size="icon-sm"
                variant={focusing ? "secondary" : "default"}
                onClick={() => setFocusing((v) => !v)}
              >
                {focusing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
