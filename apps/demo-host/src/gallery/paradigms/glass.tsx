import * as React from "react"
import { ArrowUpRight, Bell, Music2, Sparkles, TrendingUp } from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { StyleHeader, Reveal } from "./shared"

/**
 * Glassmorphism · 炫彩玻璃
 * Dribbble 流行的高级感：炫彩渐变背景 + 磨砂玻璃卡片（backdrop-blur）+
 * 大圆角 + 光斑层次 + 白字。年轻、设计感、情绪价值。
 */

/**
 * 液态玻璃：强 blur + 半透明白分层 + 顶部高光带（反射）+ 内高光边（inset）。
 * 水感来自玻璃自身，不需要彩色背景衬托。
 */
const GLASS =
  "relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-white/50 bg-white/40 " +
  "shadow-[0_12px_40px_rgba(30,40,80,0.1),inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(255,255,255,0.08)] " +
  "dark:border-white/15 dark:bg-white/[0.07] " +
  "dark:shadow-[0_16px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] " +
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/4 " +
  "before:bg-linear-to-b before:from-white/[0.14] before:to-transparent " +
  "dark:before:from-white/[0.06]"

export function GlassParadigm() {
  return (
    <div>
      <StyleHeader
        tag="Glassmorphism"
        name="液态玻璃"
        desc="液态玻璃：强磨砂 + 顶部高光 + 内高光边 + 干净背景（Apple Liquid Glass）"
      />

      <div className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8">
        {/* 极淡光晕：给液态玻璃一点可磨的对象，但不喧宾夺主 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{
            background:
              "radial-gradient(520px 180px at 20% 0%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 70%), radial-gradient(420px 150px at 80% 0%, color-mix(in oklch, var(--primary) 5%, transparent), transparent 70%)",
          }}
        />

        <div className="relative">
          {/* 顶栏 */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground/90">
              <span className="flex size-8 items-center justify-center rounded-xl border border-border bg-primary/10 backdrop-blur">
                <Sparkles className="size-4" />
              </span>
              <span className="font-semibold tracking-tight">Aurora</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative flex size-9 items-center justify-center rounded-full border border-border/70 bg-card/55 backdrop-blur transition-colors hover:bg-muted/60"
              >
                <Bell className="size-4 text-foreground" />
                <span className="bg-rose-400 absolute right-1.5 top-1.5 size-1.5 rounded-full" />
              </button>
              <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full text-sm font-semibold">
                A
              </span>
            </div>
          </div>

          {/* 欢迎卡（主玻璃卡） */}
          <Reveal>
            <div className={GLASS + " mb-5 p-6"}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-foreground/70 text-sm">Tuesday · 晚上好，Ada</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                    今日灵感<span className="text-foreground/60">，随光而来</span>
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-foreground/65">
                    你收藏的 3 个趋势正在升温，音乐与效率主题最受关注。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="border-border bg-primary/10 text-foreground backdrop-blur hover:bg-primary/15"
                  >
                    <Music2 className="size-3.5" /> 播放精选
                  </Button>
                  <Button
                    size="sm"
                    
                  >
                    查看灵感 <ArrowUpRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 指标玻璃卡 */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "本周灵感", value: "128", trend: "+24%", icon: "✦" },
              { label: "创作时长", value: "16.4h", trend: "+8%", icon: "◍" },
              { label: "收藏趋势", value: "37", trend: "+12%", icon: "◎" },
            ].map((m, i) => (
              <Reveal key={m.label} delay={i * 80}>
                <div className={GLASS + " p-5"}>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/70 text-xs">{m.label}</span>
                    <span className="text-foreground/80 text-sm">{m.icon}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-foreground tabular-nums">{m.value}</span>
                    <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-300">
                      <TrendingUp className="size-3" /> {m.trend}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 主副玻璃卡 */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Reveal delay={150} className="lg:col-span-2">
              <div className={GLASS + " p-5"}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">创作趋势</span>
                  <Badge className="border-border/70 bg-primary/10 text-foreground">近 14 天</Badge>
                </div>
                <div className="flex h-32 items-end gap-2">
                  {[35, 55, 42, 68, 50, 78, 62, 88, 70, 95, 82, 100].map((v, i) => (
                    <div key={i} className="group relative flex-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-primary/35 to-primary/10 transition-all hover:to-primary/25"
                        style={{ height: `${v}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={220}>
              <div className={GLASS + " h-full p-5"}>
                <span className="text-sm font-medium text-foreground">灵感流</span>
                <div className="mt-3 space-y-2.5">
                  {[
                    { t: "磨砂玻璃组件化", tag: "设计", time: "10m" },
                    { t: "渐变背景取色规范", tag: "配色", time: "32m" },
                    { t: "光斑层次与 z-index", tag: "实现", time: "1h" },
                  ].map((item, i) => (
                    <Reveal key={item.t} delay={260 + i * 70}>
                      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2.5 transition-colors hover:bg-primary/10">
                        <span className="size-2 shrink-0 rounded-full bg-primary/60" />
                        <span className="flex-1 truncate text-[13px] text-foreground/90">{item.t}</span>
                        <span className="text-foreground/50 text-[11px]">{item.time}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  )
}
