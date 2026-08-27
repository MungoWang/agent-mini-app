import * as React from "react"

/** 数字滚动（范式 demo 共用；正式组件化后进组件库 CountUp） */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/** 入场 stagger（范式 demo 共用；正式组件化后进组件库 Reveal） */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div
      className={"animate-in fade-in slide-in-from-bottom-2 fill-mode-both " + className}
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      {children}
    </div>
  )
}

/** 风格分组的标题区 */
export function StyleHeader({
  name,
  desc,
  tag,
}: {
  name: string
  desc: string
  tag: string
}) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-xs font-semibold tracking-wide text-primary uppercase">{tag}</span>
      <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </div>
  )
}
