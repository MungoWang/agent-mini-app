"use client"

import { differenceInCalendarDays, min, max } from "date-fns"

export type GanttTask = {
  id: string
  title: string
  start: Date
  end: Date
}

export function Gantt({ tasks }: { tasks: GanttTask[] }) {
  if (tasks.length === 0) {
    return <div data-testid="gantt" className="text-muted-foreground text-sm">No tasks</div>
  }
  const start = min(tasks.map((task) => task.start))
  const end = max(tasks.map((task) => task.end))
  const span = Math.max(differenceInCalendarDays(end, start), 1)
  return (
    <div className="flex flex-col gap-2" data-testid="gantt">
      {tasks.map((task) => {
        const offset = differenceInCalendarDays(task.start, start)
        const width = Math.max(differenceInCalendarDays(task.end, task.start), 1)
        return (
          <div key={task.id} className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <div className="truncate text-sm">{task.title}</div>
            <div className="relative h-7 rounded-md bg-muted">
              <div
                className="absolute top-1 bottom-1 rounded-sm bg-primary/70"
                style={{
                  left: `${(offset / span) * 100}%`,
                  width: `${(width / span) * 100}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
