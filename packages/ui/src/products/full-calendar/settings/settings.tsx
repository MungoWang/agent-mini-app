import { SettingsIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui/components/dropdown-menu"
import { Input } from "@monkey-mini-app/ui/components/input"
import { Switch } from "@monkey-mini-app/ui/components/switch"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

import { MAX_SCROLL_HOUR, MIN_SCROLL_HOUR, useCalendar } from "../contexts/calendar-context"

export function Settings() {
  const {
    badgeVariant,
    setBadgeVariant,
    use24HourFormat,
    toggleTimeFormat,
    startOfDayHour,
    setStartOfDayHour,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
  } = useCalendar()
  const t = useLabels("eventCalendar")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background"
        aria-label={t.settingsAria}
      >
        <SettingsIcon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.settings}</DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2 px-1.5 py-1.5 text-sm">
            <span>{t.useDotBadge}</span>
            <Switch
              checked={badgeVariant === "dot"}
              onCheckedChange={(checked) => setBadgeVariant(checked ? "dot" : "colored")}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-1.5 py-1.5 text-sm">
            <span>{t.use24Hour}</span>
            <Switch checked={use24HourFormat} onCheckedChange={() => toggleTimeFormat()} />
          </div>
          <div className="flex items-center justify-between gap-2 px-1.5 py-1.5 text-sm">
            <span>{t.scrollHour}</span>
            <Input
              type="number"
              className="h-7 w-16"
              min={MIN_SCROLL_HOUR}
              max={MAX_SCROLL_HOUR}
              value={startOfDayHour}
              onChange={(e) => setStartOfDayHour(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={agendaModeGroupBy}
          onValueChange={(value) => setAgendaModeGroupBy(value as "date" | "color")}
        >
          <DropdownMenuLabel>{t.agendaGroupBy}</DropdownMenuLabel>
          <DropdownMenuRadioItem value="date">{t.groupByDate}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="color">{t.groupByColor}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
