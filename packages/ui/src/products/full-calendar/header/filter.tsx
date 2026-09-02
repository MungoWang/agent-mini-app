import { CheckIcon, Filter, RefreshCcw } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui/components/dropdown-menu"
import { Separator } from "@monkey-mini-app/ui/components/separator"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

import { useCalendar } from "../contexts/calendar-context"
import type { TEventColor } from "../types"

const COLORS: TEventColor[] = ["blue", "green", "red", "yellow", "purple", "orange"]

export default function FilterEvents() {
  const { selectedColors, filterEventsBySelectedColors, clearFilter } = useCalendar()
  const t = useLabels("eventCalendar")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background">
        <Filter className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        {COLORS.map((color) => (
          <DropdownMenuItem
            key={color}
            className="flex cursor-pointer items-center gap-2"
            onClick={(e) => {
              e.preventDefault()
              filterEventsBySelectedColors(color)
            }}
          >
            <span className="size-3.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex items-center gap-2 capitalize">
              {color}
              {selectedColors.includes(color) ? <CheckIcon className="size-4 text-blue-500" /> : null}
            </span>
          </DropdownMenuItem>
        ))}
        <Separator className="my-2" />
        <DropdownMenuItem
          disabled={selectedColors.length === 0}
          className="flex cursor-pointer gap-2"
          onClick={(e) => {
            e.preventDefault()
            clearFilter()
          }}
        >
          <RefreshCcw className="size-3.5" />
          {t.clearFilter}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
