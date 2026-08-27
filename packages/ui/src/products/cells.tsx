import { StatusBadge } from "@monkey-mini-app/ui/blocks/status-badge"

export function TextCell({ value }: { value: unknown }) {
  return <span className="truncate">{String(value ?? "")}</span>
}

export function StatusCell({ value }: { value: unknown }) {
  return <StatusBadge status={String(value ?? "pending")} />
}

export function BooleanCell({ value }: { value: unknown }) {
  return <span className="text-muted-foreground">{value ? "Yes" : "No"}</span>
}

export function NumberCell({ value }: { value: unknown }) {
  const n = Number(value)
  return <span className="tabular-nums">{Number.isFinite(n) ? n.toLocaleString() : "—"}</span>
}
