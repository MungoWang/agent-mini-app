import * as React from "react"
import { Circle, CircleDot, Play, TerminalSquare, Zap } from "lucide-react"
import { StyleHeader, Reveal } from "./shared"

/**
 * Terminal Mono · 终端等宽
 * 强制暗色局部 + 等宽字体 + 状态灯 + 紧凑有序。
 * 参照：Linear / GitHub Actions 的终端感。
 */
const TERM_BG = "oklch(0.16 0.02 265)"
const TERM_BG_LIGHT = "oklch(0.975 0.005 265)"

export function TerminalParadigm() {
  const [, force] = React.useState(0)
  React.useEffect(() => {
    const mo = new MutationObserver(() => force((n) => n + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])
  return (
    <div>
      <StyleHeader
        tag="Terminal Mono"
        name="终端等宽"
        desc="等宽字体 · 状态灯 · 紧凑数据行（局部暗色，适合监控/CI/日志）"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 主面板：任务列表 + 状态 */}
        <Reveal className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border" style={{ background: document.documentElement.classList.contains("dark") ? TERM_BG : TERM_BG_LIGHT }}>
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="text-slate-700/40 dark:text-white/40 ml-2 font-mono text-xs">deploy --watch</span>
            </div>
            <div className="p-4 font-mono text-[13px] leading-relaxed">
              {[
                { t: "$ pnpm build", s: "ok", c: "text-emerald-600 dark:text-emerald-400" },
                { t: "$ lint --strict", s: "ok", c: "text-emerald-600 dark:text-emerald-400" },
                { t: "$ test --coverage 92%", s: "ok", c: "text-emerald-600 dark:text-emerald-400" },
                { t: "$ deploy to prod…", s: "run", c: "text-amber-600 dark:text-amber-300 animate-pulse" },
              ].map((line, i) => (
                <Reveal key={line.t} delay={80 + i * 90}>
                  <div className="flex items-center gap-3 py-0.5">
                    <span className={"shrink-0 " + line.c}>
                      {line.s === "run" ? (
                        <Play className="size-3 fill-current" />
                      ) : (
                        <CircleDot className="size-3" />
                      )}
                    </span>
                    <span className="text-slate-700/85 dark:text-white/85">{line.t}</span>
                    <span className="text-slate-700/30 dark:text-white/30 ml-auto tabular-nums">{line.s}</span>
                  </div>
                </Reveal>
              ))}
              <Reveal delay={450}>
                <div className="mt-3 border-t border-slate-200 dark:border-white/10 pt-3 text-slate-700/45 dark:text-slate-500 dark:text-white/45">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span> 3 passed · <span className="text-amber-600 dark:text-amber-300">●</span> 1 running
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        {/* 侧栏：指标 + 源状态 */}
        <Reveal delay={150}>
          <div className="flex h-full flex-col gap-3 font-mono">
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 p-4" style={{ background: document.documentElement.classList.contains("dark") ? TERM_BG : TERM_BG_LIGHT }}>
              <div className="text-slate-700/40 dark:text-white/40 mb-3 text-xs uppercase">cluster</div>
              {[
                ["web", "3/3", "text-emerald-600 dark:text-emerald-400"],
                ["worker", "2/3", "text-amber-600 dark:text-amber-300"],
                ["db", "1/1", "text-emerald-600 dark:text-emerald-400"],
              ].map(([name, status, color]) => (
                <div key={name} className="flex items-center justify-between py-1.5 text-[13px]">
                  <span className="text-slate-700/70 dark:text-white/70">{name}</span>
                  <span className={"flex items-center gap-1.5 " + color}>
                    <Circle className="size-2 fill-current" />
                    {status}
                  </span>
                </div>
              ))}
              <div className="mt-3 border-t border-slate-200 dark:border-white/10 pt-3">
                <div className="text-slate-700/40 dark:text-white/40 mb-1.5 text-xs uppercase">p95 latency</div>
                <div className="text-2xl font-semibold text-slate-700 dark:text-white tabular-nums">
                  84<span className="text-slate-700/40 dark:text-white/40 text-sm">ms</span>
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 mt-1 text-xs">-12% vs last week</div>
              </div>
            </div>
            <Reveal delay={240}>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4" style={{ background: document.documentElement.classList.contains("dark") ? TERM_BG : TERM_BG_LIGHT }}>
                <div className="text-slate-700/40 dark:text-white/40 mb-2 flex items-center gap-1.5 text-xs uppercase">
                  <TerminalSquare className="size-3.5" /> quick
                </div>
                <div className="text-slate-700/70 dark:text-white/70 text-[13px] leading-6">
                  <span className="text-slate-700/35 dark:text-white/35">$</span> rollback --tag v2.3.1
                </div>
                <div className="text-slate-700/70 dark:text-white/70 text-[13px] leading-6">
                  <span className="text-slate-700/35 dark:text-white/35">$</span> tail --app worker
                </div>
                <div className="mt-2 flex items-center gap-2 text-slate-700/45 dark:text-slate-500 dark:text-white/45 text-xs">
                  <Zap className="size-3 text-amber-600 dark:text-amber-300" />
                  tab 补全可用
                </div>
              </div>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
