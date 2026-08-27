import type { ReactNode } from "react"

export function Example({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-3 border-b py-8 last:border-b-0">
      <div>
        <h2 className="text-sm font-medium tracking-wide uppercase">{title}</h2>
        {hint ? <p className="text-muted-foreground mt-1 text-sm">{hint}</p> : null}
      </div>
      <div className="rounded-xl border bg-card p-4">{children}</div>
    </section>
  )
}
