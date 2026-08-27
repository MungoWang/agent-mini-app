import * as React from "react"
import {
  CheckCircle2,
  Circle,
  GitBranch,
  MoreHorizontal,
  Play,
  Plus,
  Rocket,
  XCircle,
} from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { Progress } from "@monkey-mini-app/ui/components/progress"
import { StyleHeader, Reveal } from "./shared"

/**
 * Semantic Palette · 语义色板
 * 黑白灰为底 + 彩色只表达状态（蓝=进行/绿=完成/橙=风险/紫=评审）。
 * 完整可操作：任务勾选、branch 标记、测试用例执行、卡片部署。
 */

const STATUS = {
  todo: "bg-muted text-muted-foreground",
  doing: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  review: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  done: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  risk: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
} as const

type Task = {
  key: string
  title: string
  tag: "todo" | "doing" | "review" | "done"
  assignee: string
  points: number
  branch?: string
  deploy?: "idle" | "running" | "done"
}

const TAG_BAR: Record<Task["tag"], string> = {
  todo: "border-l-muted",
  doing: "border-l-sky-500",
  review: "border-l-violet-500",
  done: "border-l-emerald-500",
}

function TaskCard({
  task,
  onToggle,
  onDeploy,
}: {
  task: Task
  onToggle: () => void
  onDeploy: () => void
}) {
  const done = task.tag === "done"
  return (
    <div
      className={
        "group cursor-pointer rounded-md border border-l-[3px] bg-white/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:bg-card/90 " +
        TAG_BAR[task.tag]
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground/60 flex items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            aria-label="toggle done"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {done ? (
              <CheckCircle2 className="text-emerald-500 size-4" />
            ) : (
              <Circle className="text-muted-foreground/50 size-4" />
            )}
          </button>
          {task.key}
        </span>
        <MoreHorizontal className="text-muted-foreground/40 size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className={"text-[13px] leading-snug font-medium " + (done ? "text-muted-foreground line-through" : "")}>
        {task.title}
      </div>
      {task.branch ? (
        <div className="bg-muted text-muted-foreground mt-2 inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 font-mono text-[10px]">
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{task.branch}</span>
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center justify-between">
        <span className={"rounded-md px-1.5 py-0.5 text-[10px] font-semibold " + STATUS[task.tag]}>
          {task.tag === "doing" ? "进行" : task.tag === "review" ? "评审" : task.tag === "done" ? "完成" : "待办"}
        </span>
        <span className="flex items-center gap-2">
          {task.deploy ? (
            task.deploy === "running" ? (
              <Button size="icon-xs" variant="outline" className="text-sky-500 h-5 w-9 animate-pulse text-[10px]">
                部署中
              </Button>
            ) : (
              <Button size="icon-xs" variant="ghost" className="text-emerald-500 h-5 gap-0.5 px-1 text-[10px]">
                <Rocket className="size-3" /> 已部署
              </Button>
            )
          ) : task.tag === "done" ? (
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground h-5 gap-0.5 px-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onDeploy()
              }}
            >
              <Rocket className="size-3" /> 部署
            </Button>
          ) : null}
          <span className="text-muted-foreground/50 text-[10px] tabular-nums">{task.points}pt</span>
          <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full text-[9px] font-semibold">
            {task.assignee.slice(0, 1)}
          </span>
        </span>
      </div>
    </div>
  )
}

/* 测试用例：可执行 */
function TestCaseRow({ id, name, onRun }: { id: string; name: string; onRun: () => void }) {
  const [state, setState] = React.useState<"idle" | "run" | "pass" | "fail">("idle")
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
      <span className="text-muted-foreground/60 w-14 shrink-0 font-mono text-[11px]">{id}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
      {state === "pass" ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
          <CheckCircle2 className="size-3.5" /> 通过
        </span>
      ) : state === "fail" ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
          <XCircle className="size-3.5" /> 失败
        </span>
      ) : state === "run" ? (
        <span className="text-sky-500 h-3 w-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-6 gap-1 px-1.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => {
            setState("run")
            setTimeout(() => setState(Math.random() > 0.3 ? "pass" : "fail"), 900)
          }}
        >
          <Play className="size-3" /> 执行
        </Button>
      )}
    </div>
  )
}

export function SemanticParadigm() {
  const [tasks, setTasks] = React.useState<Task[]>([
    { key: "RADAR-42", title: "拆分大卡片组件", tag: "todo", assignee: "Ada", points: 5, branch: "feat/card-split" },
    { key: "RADAR-38", title: "看板拖拽性能优化", tag: "doing", assignee: "Ada", points: 8, branch: "perf/dnd" },
    { key: "RADAR-44", title: "语义色板落地到模板", tag: "doing", assignee: "Cici", points: 5, branch: "feat/semantic" },
    { key: "RADAR-40", title: "Reveal 组件 API 评审", tag: "review", assignee: "Ben", points: 3, branch: "feat/reveal" },
    { key: "RADAR-35", title: "CountUp 数字滚动", tag: "done", assignee: "Ada", points: 2 },
    { key: "RADAR-36", title: "PageHero 渐变标题", tag: "done", assignee: "Cici", points: 5, branch: "feat/hero" },
  ])
  const [sprint, setSprint] = React.useState(true)

  const toggleTask = (key: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.key === key ? { ...t, tag: t.tag === "done" ? "doing" : "done" } : t
      )
    )
  const deployTask = (key: string) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, deploy: "running" } : t)))
    setTimeout(
      () => setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, deploy: "done" } : t))),
      1800
    )
  }

  const doneCount = tasks.filter((t) => t.tag === "done").length

  return (
    <div>
      <StyleHeader
        tag="Semantic Palette"
        name="语义色板"
        desc="色彩即结构：列级彩色分区 + 卡片左色条 · 任务/用例/部署可操作"
      />

      {/* sprint 概要 + 操作 */}
      <Reveal>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["Ada", "Ben", "Cici", "Dan"].map((n) => (
                <span
                  key={n}
                  className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold"
                >
                  {n.slice(0, 1)}
                </span>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                Sprint 34 · 智能归档
                <Badge variant={sprint ? "default" : "secondary"} className="text-[10px]">
                  {sprint ? "进行中" : "已结束"}
                </Badge>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="bg-muted h-1.5 w-28 overflow-hidden rounded-full">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(doneCount / 6) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {doneCount}/6 · 剩余 8 天
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSprint((v) => !v)}
            >
              {sprint ? "结束 Sprint" : "重新开启"}
            </Button>
            <Button size="sm">
              <Plus className="size-3.5" /> 新建任务
            </Button>
          </div>
        </div>
      </Reveal>

      {/* 看板：任务可勾选 / 部署 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { col: "待办", dot: "bg-muted", tint: "bg-zinc-400/[0.04]", filter: (t: Task) => t.tag === "todo" },
          { col: "进行中", dot: "bg-sky-500", tint: "bg-sky-500/[0.06]", filter: (t: Task) => t.tag === "doing" },
          { col: "评审", dot: "bg-violet-500", tint: "bg-violet-500/[0.06]", filter: (t: Task) => t.tag === "review" },
          { col: "完成", dot: "bg-emerald-500", tint: "bg-emerald-500/[0.06]", filter: (t: Task) => t.tag === "done" },
        ].map((group, gi) => (
          <Reveal key={group.col} delay={gi * 70}>
            <div className={"rounded-lg border p-2.5 " + group.tint}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <span className={"size-1.5 rounded-full " + group.dot} />
                  {group.col}
                </span>
                <span className="text-muted-foreground/60 text-[11px] tabular-nums">
                  {tasks.filter(group.filter).length}
                </span>
              </div>
              <div className="space-y-2">
                {tasks.filter(group.filter).map((task, ti) => (
                  <Reveal key={task.key} delay={gi * 70 + 60 + ti * 40}>
                    <TaskCard task={task} onToggle={() => toggleTask(task.key)} onDeploy={() => deployTask(task.key)} />
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* 测试用例管理（可执行）+ 团队产能 */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Reveal delay={150} className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">测试用例 · RADAR-38</span>
              <Badge variant="secondary" className="text-[10px]">
                悬停行末出现「执行」
              </Badge>
            </div>
            <div className="group space-y-0.5">
              {[
                ["TC-01", "拖拽 200 卡片无卡顿"],
                ["TC-02", "跨列移动后顺序正确"],
                ["TC-03", "刷新后状态持久化"],
                ["TC-04", "键盘可达性（拖拽替代）"],
              ].map(([id, name]) => (
                <TestCaseRow key={id} id={id} name={name} onRun={() => {}} />
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-sm font-medium">团队产能</div>
            {[
              ["Ada", 12, 15],
              ["Ben", 9, 10],
              ["Cici", 8, 13],
              ["Dan", 6, 7],
            ].map(([n, v, total]) => (
              <div key={String(n)} className="mb-2.5">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{n}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {String(v)}/{String(total)}
                  </span>
                </div>
                <Progress value={Number((Number(v) / Number(total)) * 100)} />
              </div>
            ))}
            <div className="text-muted-foreground mt-1 text-[11px]">容量 89% · 正常</div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
