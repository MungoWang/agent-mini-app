import * as React from "react"
import { Activity, Cpu, Gauge, Radio } from "lucide-react"
import { useCountUp, StyleHeader, Reveal } from "./shared"

/**
 * Dark Data · 暗夜数据
 * 强制暗色 + 荧光强调（emerald/cyan）+ 细网格 + 大数字。
 * 参照：金融大盘 / 监控大屏（适合数字密集但要有秩序）。
 */
const DATA_BG = "oklch(0.12 0.03 195.31 / 0.91)"
const GRID_LINE = "rgba(160,210,255,0.05)"
const PANEL_LINE = "rgba(160,210,255,0.08)"

function Metric({
  label,
  value,
  unit,
  tone,
  delay,
  dark,
}: {
  label: string
  value: number
  unit: string
  tone: string
  delay: number
  dark: boolean
}) {
  const n = useCountUp(value, 1200)
  return (
    <Reveal delay={delay}>
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: dark ? PANEL_LINE : "rgba(15,23,42,0.06)",
          background: dark ? "rgba(160,210,255,0.03)" : "rgba(255,255,255,0.3)",
          backdropFilter: dark ? undefined : "blur(50px)",
          border: dark ? undefined : "0.5px solid rgba(255,255,255,0.4)",
          borderColor: dark ? PANEL_LINE : undefined,
          boxShadow: dark ? "none" : "0 4px 24px rgba(60,80,110,0.07), inset 0 1px 0 rgba(255,255,255,0.45)",
        }}
      >
        <div className={"text-xs font-medium tracking-wide uppercase " + (dark ? "text-white/40" : "text-[#3E5A4A]/80")}>{label}</div>
        <div className={"mt-1.5 text-3xl font-semibold tabular-nums " + tone}>
          {n}
          <span className={"ml-0.5 text-sm " + (dark ? "text-white/35" : "text-[#0E2A1F]/50")}>{unit}</span>
        </div>
      </div>
    </Reveal>
  )
}

export function DarkDataParadigm() {
  const [dark, setDark] = React.useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  )
  React.useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains("dark"))
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])

  return (
    <div>
      <StyleHeader
        tag="Ethereal Mist"
        name="流光迷雾"
        desc="light：流体雾感背景 + 透光白卡 + 马卡龙荧光 · dark：深青蓝大屏（同布局双氛围）"
      />

      <div
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          // light = 流光迷雾流体渐变（冷灰#F5F7F8 + 薄荷绿 + 淡粉紫，缓慢晕染）
          // dark = 深青蓝大屏
          background: dark
            ? "linear-gradient(130deg, oklch(0.12 0.03 195) 0%, oklch(0.145 0.038 212) 48%, oklch(0.105 0.026 183) 100%)"
            : "linear-gradient(120deg, #E2D5F3 0%, #D4F2E7 32%, #FEEAD2 62%, #E8DCF5 82%, #D8F2E9 100%)",
          backgroundSize: "300% 300%",
          animation: "mma-bg-drift 20s ease-in-out infinite",
        }}
      >
        <style>{`
          @keyframes mma-neon {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
          @keyframes mma-bg-drift {
            0%, 100% { background-position: 0% 0%; }
            50% { background-position: 100% 45%; }
          }
          /* 烟雾变形：多关键帧 + skew 扭曲 + 大幅缩放（真·变形流动） */
          @keyframes mma-mist-a {
            0% { transform: translate3d(-70px, -20px, 0) scale(1) skewX(0deg) skewY(0deg); opacity: 0.4; }
            30% { transform: translate3d(20px, 50px, 0) scale(1.5) skewX(-10deg) skewY(4deg); opacity: 0.95; }
            62% { transform: translate3d(110px, -30px, 0) scale(0.85) skewX(8deg) skewY(-5deg); opacity: 0.5; }
            100% { transform: translate3d(-70px, -20px, 0) scale(1) skewX(0deg) skewY(0deg); opacity: 0.4; }
          }
          @keyframes mma-mist-b {
            0% { transform: translate3d(80px, 40px, 0) scale(1.15) skewX(0deg); opacity: 0.4; }
            34% { transform: translate3d(-60px, -40px, 0) scale(0.7) skewX(12deg) skewY(-6deg); opacity: 0.9; }
            68% { transform: translate3d(-120px, 20px, 0) scale(1.55) skewX(-8deg) skewY(5deg); opacity: 0.55; }
            100% { transform: translate3d(80px, 40px, 0) scale(1.15) skewX(0deg); opacity: 0.4; }
          }
          @keyframes mma-mist-c {
            0% { transform: translate3d(40px, -60px, 0) scale(0.95) skewX(0deg); opacity: 0.38; }
            28% { transform: translate3d(-70px, 30px, 0) scale(1.45) skewX(-6deg) skewY(8deg); opacity: 0.92; }
            58% { transform: translate3d(20px, 80px, 0) scale(0.8) skewX(10deg) skewY(-4deg); opacity: 0.5; }
            100% { transform: translate3d(40px, -60px, 0) scale(0.95) skewX(0deg); opacity: 0.38; }
          }
        `}</style>
        {/* 飘忽烟雾：大 blur 光斑缓慢漂移（无网格线） */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 h-[110%] w-[85%]"
          style={{
            background: dark
              ? "radial-gradient(ellipse, rgba(56,189,248,0.28), rgba(56,189,248,0.08) 45%, transparent 75%)"
              : "radial-gradient(ellipse, rgba(186,150,235,0.65), rgba(186,150,235,0.2) 45%, transparent 75%)",
            filter: "blur(85px)",
            animation: "mma-mist-a 9s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-8 h-[100%] w-[80%]"
          style={{
            background: dark
              ? "radial-gradient(ellipse, rgba(103,232,249,0.24), rgba(103,232,249,0.06) 45%, transparent 75%)"
              : "radial-gradient(ellipse, rgba(140,230,195,0.6), rgba(140,230,195,0.18) 45%, transparent 75%)",
            filter: "blur(95px)",
            animation: "mma-mist-b 11s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/4 h-[85%] w-[95%]"
          style={{
            background: dark
              ? "radial-gradient(ellipse, rgba(125,211,252,0.2), rgba(125,211,252,0.05) 45%, transparent 75%)"
              : "radial-gradient(ellipse, rgba(255,200,140,0.6), rgba(255,200,140,0.18) 45%, transparent 75%)",
            filter: "blur(90px)",
            animation: "mma-mist-c 13s ease-in-out infinite",
          }}
        />
        <div className="relative">
          {/* 顶栏 */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              </span>
              <span className="text-[#12263B] font-mono text-sm dark:text-white/80">MARKET · LIVE</span>
            </div>
            <div className="text-[#12263B]/60 font-mono text-xs tabular-nums dark:text-white/40">
              2026-08-26 20:30:00 UTC+8
            </div>
          </div>

          {/* 指标行 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric dark={dark} label="总市值" value={1284} unit="亿" tone="text-[#0E2A1F] dark:text-white" delay={60} />
            <Metric dark={dark} label="24h 成交" value={86.4} unit="亿" tone="text-emerald-800 dark:text-emerald-400" delay={130} />
            <Metric dark={dark} label="活跃标的" value={312} unit="" tone="text-sky-900 dark:text-cyan-300" delay={200} />
            <Metric dark={dark} label="波动率" value={4.2} unit="%" tone="text-amber-800 dark:text-amber-300" delay={270} />
          </div>

          {/* 主图区 */}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Reveal delay={200} className="lg:col-span-2">
              <div
                className="flex h-48 flex-col rounded-xl border p-4"
                style={{ borderColor: dark ? PANEL_LINE : "rgba(15,23,42,0.06)", background: dark ? "rgba(160,210,255,0.02)" : "rgba(255,255,255,0.8)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#16324a]/75 font-mono text-xs dark:text-white/60">INDEX · 24h</span>
                  <span className="text-emerald-500 font-mono dark:text-emerald-400 text-sm tabular-nums">+6.4%</span>
                </div>
                {/* 示意走势（纯 CSS 折线） */}
                <svg
                  viewBox="0 0 400 120"
                  className="mt-2 flex-1 w-full"
                  preserveAspectRatio="none"
                  style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.45))", animation: "mma-neon 4.5s ease-in-out infinite" }}
                >
                  <defs>
                    <linearGradient id="dd-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,90 C40,84 60,92 90,80 C120,68 150,74 180,62 C210,50 240,58 270,44 C300,32 330,40 360,26 L400,18"
                    fill="none"
                    stroke="rgba(56,189,248,0.6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0,90 C40,84 60,92 90,80 C120,68 150,74 180,62 C210,50 240,58 270,44 C300,32 330,40 360,26 L400,18 L400,120 L0,120 Z"
                    fill="url(#dd-area)"
                  />
                  <circle cx="400" cy="18" r="3.5" fill="url(#dd-area)" />
                </svg>
              </div>
            </Reveal>

            <Reveal delay={270}>
              <div
                className="flex h-48 flex-col rounded-xl border p-4"
                style={{ borderColor: dark ? PANEL_LINE : "rgba(15,23,42,0.06)", background: dark ? "rgba(160,210,255,0.02)" : "rgba(255,255,255,0.8)" }}
              >
                <div className="text-[#16324a]/75 font-mono text-xs dark:text-white/60 uppercase">top movers</div>
                <div className="mt-2 space-y-2 font-mono">
                  {[
                    ["RADAR", "+18.2%", "text-emerald-500 dark:text-emerald-400"],
                    ["TOKEN-A", "+9.6%", "text-emerald-500 dark:text-emerald-400"],
                    ["ORB-7", "-3.1%", "text-rose-500 dark:text-rose-400"],
                  ].map(([name, pct, color], i) => (
                    <Reveal key={name} delay={320 + i * 70}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-[#12263B]/80 dark:text-white/75">
                          <Radio className="size-3 text-[#12263B]/45 dark:text-white/30" />
                          {name}
                        </span>
                        <span className={"tabular-nums " + color}>{pct}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-3 border-t pt-3" style={{ borderColor: dark ? GRID_LINE : "rgba(15,23,42,0.05)" }}>
                  <span className="flex items-center gap-1 text-[#16324a]/70 font-mono text-xs dark:text-white/50">
                    <Cpu className="size-3.5" /> 24 core
                  </span>
                  <span className="flex items-center gap-1 text-[#16324a]/70 font-mono text-xs dark:text-white/50">
                    <Gauge className="size-3.5" /> 62%
                  </span>
                  <span className="ml-auto text-[#12263B]/45 dark:text-white/30 font-mono text-xs">
                    <Activity className="size-3.5" />
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  )
}
