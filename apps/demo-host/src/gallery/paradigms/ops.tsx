import * as React from "react"
import {
  Activity,
  CheckCircle2,
  Circle,
  Cloud,
  GitBranch,
  Globe,
  Loader2,
  Rocket,
  TerminalSquare,
} from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { Progress } from "@monkey-mini-app/ui/components/progress"
import { StyleHeader, Reveal } from "./shared"

/**
 * Cyberpunk 科技后台（Web3 / AI 数据平台）。
 * 深蓝黑底 + 霓虹发光（青/蓝/橙）+ 弱边框、区块靠明暗深浅划分。
 */

type Repo = { name: string; branch: string; status: "idle" | "queued" | "building" | "done" }

const INITIAL_REPOS: Repo[] = [
  { name: "api-gateway", branch: "feat/rate-limit", status: "idle" },
  { name: "auth-service", branch: "fix/session", status: "idle" },
  { name: "web-frontend", branch: "feat/dashboard-v2", status: "idle" },
  { name: "worker-queue", branch: "main", status: "idle" },
]

const PIPELINE = ["Checkout", "Install", "Test", "Build", "Deploy"]

/** 区块：深灰蓝，靠明暗划分，无实边框 */
const BLOCK = "rounded-lg bg-white/40 backdrop-blur-2xl border border-white/50 dark:bg-white/[0.03] dark:backdrop-blur-none dark:border-transparent"

/** 霓虹发光 shadow */
const NEON_CYAN = "0 0 10px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.2)"
const NEON_EMERALD = "0 0 10px rgba(52,211,153,0.5), 0 0 20px rgba(52,211,153,0.18)"
const NEON_AMBER = "0 0 10px rgba(251,191,36,0.45), 0 0 20px rgba(251,191,36,0.15)"

export function OpsParadigm() {
  const [, force] = React.useState(0)
  React.useEffect(() => {
    const mo = new MutationObserver(() => force((n) => n + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])
  const [repos, setRepos] = React.useState<Repo[]>(INITIAL_REPOS)
  const [selected, setSelected] = React.useState<Set<string>>(new Set(["api-gateway", "web-frontend"]))
  const [pipeline, setPipeline] = React.useState<number>(-1)

  const toggleSelect = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const deploySelected = () => {
    const queue = [...selected]
    setRepos((prev) => prev.map((r) => (selected.has(r.name) ? { ...r, status: "queued" } : r)))
    let i = 0
    const tick = () => {
      if (i >= queue.length) return
      const name = queue[i]
      setRepos((prev) => prev.map((r) => (r.name === name ? { ...r, status: "building" } : r)))
      setTimeout(() => {
        setRepos((prev) => prev.map((r) => (r.name === name ? { ...r, status: "done" } : r)))
        i++
        setTimeout(tick, 700)
      }, 900)
    }
    tick()
  }

  const runPipeline = () => {
    setPipeline(0)
    const interval = setInterval(() => {
      setPipeline((prev) => {
        if (prev >= PIPELINE.length - 1) {
          clearInterval(interval)
          return -1
        }
        return prev + 1
      })
    }, 800)
  }

  const building = repos.some((r) => r.status === "building" || r.status === "queued")

  return (
    <div>
      <StyleHeader
        tag="Cyberpunk"
        name="科技后台"
        desc="深蓝黑底 · 霓虹发光 · 弱边框区块化 · pipeline / 多 repo 部署"
      />

      <div
        className="relative overflow-hidden rounded-xl p-5"
        style={{
          background: document.documentElement.classList.contains("dark")
            ? "linear-gradient(160deg, oklch(0.16 0.045 260) 0%, oklch(0.12 0.03 255) 55%, oklch(0.1 0.025 250) 100%)"
            : "linear-gradient(120deg, #E3EEF5 0%, #EAF4F8 40%, #E2EEF3 100%)",
        }}
      >
        {/* 微弱网格 + 顶光 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(120,180,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,255,0.035) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(480px 160px at 30% 0%, rgba(34,211,238,0.08), transparent 70%), radial-gradient(420px 140px at 75% 0%, rgba(99,102,241,0.1), transparent 70%)",
          }}
        />

        <div className="relative text-slate-800 dark:text-white">
          {/* 顶栏：霓虹健康灯 + 操作 */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                <span
                  className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ boxShadow: NEON_EMERALD }}
                />
                系统在线
              </span>
              <span className="text-slate-700/50 dark:text-white/50 text-xs">
                已选 <b className="tabular-nums">{selected.size}</b> 个仓库
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="border border-cyan-600/30 dark:border-cyan-400/25 bg-cyan-500/10 dark:bg-cyan-400/[0.06] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/15 dark:hover:bg-cyan-400/15"
                onClick={runPipeline}
                disabled={pipeline >= 0}
              >
                <TerminalSquare className="size-3.5" />
                {pipeline >= 0 ? "Pipeline 运行中…" : "跑一次 Pipeline"}
              </Button>
              <Button
                size="sm"
                className="border border-cyan-600/40 dark:border-cyan-400/40 bg-cyan-500/15 dark:bg-cyan-400/15 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-500/25 dark:hover:bg-cyan-400/25"
                style={{ boxShadow: NEON_CYAN }}
                onClick={deploySelected}
                disabled={!selected.size || building}
              >
                <Rocket className="size-3.5" />
                {building ? "部署中…" : "一键部署"}
              </Button>
            </div>
          </div>

          {/* Pipeline：霓虹阶段条 */}
          {pipeline >= 0 ? (
            <Reveal>
              <div className={BLOCK + " mb-4 p-3"}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-cyan-800 dark:text-cyan-200/90 text-xs font-medium">Pipeline · deploy</span>
                  <span className="text-slate-700/40 dark:text-white/40 text-[11px] tabular-nums">
                    {pipeline + 1}/{PIPELINE.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {PIPELINE.map((stage, i) => (
                    <div key={stage} className="flex flex-1 items-center gap-2">
                      <span
                        className={
                          "flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium " +
                          (i < pipeline
                            ? "bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-300"
                            : i === pipeline
                              ? "bg-cyan-500/15 dark:bg-cyan-400/15 text-cyan-800 dark:text-cyan-200"
                              : "bg-white/50 dark:bg-white/[0.04] text-slate-700/35 dark:text-white/35")
                        }
                        style={i === pipeline ? { boxShadow: NEON_CYAN } : undefined}
                      >
                        {i < pipeline ? (
                          <CheckCircle2 className="size-3" />
                        ) : i === pipeline ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {stage}
                      </span>
                      {i < PIPELINE.length - 1 ? <span className="text-slate-700/20 dark:text-white/20 text-[10px]">→</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ) : null}

          {/* 服务矩阵：区块化（无实边框，hover 微亮） */}
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-3 pb-1 text-[10px] font-medium tracking-wide text-slate-700/30 dark:text-white/30 uppercase sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr]">
              <span>仓库 · 分支</span>
              <span className="hidden sm:block">区域</span>
              <span className="hidden sm:block">延迟</span>
              <span className="hidden sm:block">状态</span>
              <span className="text-right">操作</span>
            </div>
            {repos.map((repo, i) => (
              <Reveal key={repo.name} delay={i * 50}>
                <div
                  className={
                    "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2.5 transition-colors sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr] " +
                    (selected.has(repo.name)
                      ? "bg-cyan-500/10 dark:bg-cyan-400/[0.06]"
                      : "bg-white/35 hover:bg-white/55 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]")
                  }
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      aria-label="select"
                      onClick={() => toggleSelect(repo.name)}
                      className={
                        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors " +
                        (selected.has(repo.name)
                          ? "border-cyan-600 bg-cyan-500/20 text-cyan-700 dark:border-cyan-300 dark:bg-cyan-400/30 dark:text-cyan-100"
                          : "border-slate-300 hover:border-cyan-500/60 dark:border-white/25 dark:hover:border-cyan-300/60")
                      }
                    >
                      {selected.has(repo.name) ? <CheckCircle2 className="size-3" /> : null}
                    </button>
                    <span className="truncate font-mono text-[13px] font-medium text-slate-700/90 dark:text-white/90">{repo.name}</span>
                    <span className="text-slate-700/40 dark:text-white/40 hidden items-center gap-1 truncate font-mono text-[10px] md:inline-flex">
                      <GitBranch className="size-3 shrink-0" />
                      <span className="truncate">{repo.branch}</span>
                    </span>
                  </div>
                  <span className="text-slate-700/40 dark:text-white/40 hidden text-xs sm:block">
                    <Globe className="mr-1 inline size-3" />
                    ap-east
                  </span>
                  <span className="text-slate-700/40 dark:text-white/40 hidden text-xs tabular-nums sm:block">
                    {40 + i * 11}ms
                  </span>
                  <span className="hidden sm:block">
                    {repo.status === "done" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" style={{ boxShadow: NEON_EMERALD }} />
                        已部署
                      </span>
                    ) : repo.status === "building" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                        <Loader2 className="size-3.5 animate-spin" /> 构建中
                      </span>
                    ) : repo.status === "queued" ? (
                      <span className="text-amber-700 dark:text-amber-300 text-[11px] font-medium" style={{ textShadow: NEON_AMBER }}>
                        排队中
                      </span>
                    ) : (
                      <span className="text-slate-700/30 dark:text-white/30 text-[11px]">就绪</span>
                    )}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    {repo.status === "building" ? (
                      <div className="w-16">
                        <Progress value={62} className="h-1 [&>div]:bg-cyan-400" />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-700/50 dark:text-white/50 hover:text-cyan-800 dark:text-cyan-200 h-6 gap-1 px-1.5 text-[11px]"
                        onClick={() =>
                          setRepos((prev) =>
                            prev.map((r) => (r.name === repo.name ? { ...r, status: "building" } : r))
                          )
                        }
                      >
                        <Cloud className="size-3" /> 单独部署
                      </Button>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 底部：部署时间线（区块化） */}
          <div className="mt-4">
            <div className={BLOCK + " p-4"}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-slate-700/85 dark:text-white/85 text-xs font-medium">最近部署</span>
                <Badge variant="outline" className="border-cyan-600/30 dark:border-cyan-400/25 text-cyan-700 dark:text-cyan-300/80 text-[10px]">
                  自动回滚已开启
                </Badge>
              </div>
              <div className="space-y-2">
                {[
                  { t: "api-gateway · v2.4.1", d: "12 分钟前", done: true },
                  { t: "web-frontend · v3.1.4", d: "2 小时前", done: true },
                  { t: "worker-queue · 回滚到 v0.7.1", d: "5 小时前", warn: true },
                ].map((item, i) => (
                  <Reveal key={item.t} delay={200 + i * 60}>
                    <div className="flex items-center gap-2.5 rounded-md px-1 py-1 text-[13px] transition-colors hover:bg-white/50 dark:bg-white/[0.04]">
                      {item.warn ? (
                        <span className="text-amber-700 dark:text-amber-300" style={{ textShadow: NEON_AMBER }}>
                          <Circle className="size-3.5" />
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="size-3.5" />
                        </span>
                      )}
                      <span className="font-mono text-slate-700/80 dark:text-white/80">{item.t}</span>
                      <span className="text-slate-700/35 dark:text-white/35 ml-auto text-xs tabular-nums">{item.d}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
