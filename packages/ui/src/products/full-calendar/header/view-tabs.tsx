import { memo } from "react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

import { useCalendar } from "../contexts/calendar-context"
import type { TCalendarView } from "../types"

function Views() {
  const { view, setView } = useCalendar()
  const t = useLabels("eventCalendar")
  const tabs: { name: string; value: TCalendarView }[] = [
    { name: t.agenda, value: "agenda" },
    { name: t.day, value: "day" },
    { name: t.week, value: "week" },
    { name: t.month, value: "month" },
    { name: t.year, value: "year" },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map(({ name, value }) => (
        <Button
          key={value}
          size="sm"
          variant={view === value ? "default" : "outline"}
          data-testid={`calendar-view-${value}`}
          onClick={() => setView(value)}
        >
          {name}
        </Button>
      ))}
    </div>
  )
}

export default memo(Views)
