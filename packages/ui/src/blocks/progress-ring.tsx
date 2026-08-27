export function ProgressRing({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  const r = 16
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c
  return (
    <svg
      data-testid="progress-ring"
      viewBox="0 0 40 40"
      className="size-10 -rotate-90"
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
