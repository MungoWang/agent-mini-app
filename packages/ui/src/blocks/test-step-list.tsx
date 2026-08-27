import { StatusBadge, type StatusKey } from "@monkey-mini-app/ui/blocks/status-badge"

export type TestStep = { id: string; title: string; status: StatusKey | string }

export function TestStepList({ steps }: { steps: TestStep[] }) {
  return (
    <ol className="flex flex-col gap-2" data-testid="test-step-list">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="text-muted-foreground mr-2">{index + 1}.</span>
            {step.title}
          </span>
          <StatusBadge status={step.status} />
        </li>
      ))}
    </ol>
  )
}
