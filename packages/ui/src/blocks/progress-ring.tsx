import { cn } from "../lib/utils"

export function ProgressRing({
  value,
  size,
  className,
}: {
  value: number
  size?: number
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, value))
  const r = 16
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c
  return (
    <svg
      data-testid="progress-ring"
      viewBox="0 0 40 40"
      style={size ? { width: size, height: size } : undefined}
      className={cn("-rotate-90 size-10", className)}
    >
      <circle cx="20" cy="20" r={r} className="fill-none stroke-muted" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        className="fill-none stroke-primary"
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
