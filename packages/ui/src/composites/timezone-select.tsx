"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@monkey-mini-app/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { cn } from "@monkey-mini-app/ui/lib/utils"

const COMMON_IDS = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const

const ALIASES: Record<string, string> = {
  UTC: "gmt zulu",
  "Asia/Shanghai": "china beijing cst prc",
  "Asia/Singapore": "sg",
  "Asia/Tokyo": "japan jst",
  "Asia/Hong_Kong": "hk hongkong",
  "Europe/London": "uk gmt bst",
  "Europe/Paris": "france cet cest",
  "America/New_York": "nyc eastern est edt usa",
  "America/Los_Angeles": "pacific pst pdt la california usa",
  "Australia/Sydney": "aest australia",
}

export type ZoneInfo = {
  id: string
  city: string
  region: string
  offset: string
  search: string
}

const ianaZones =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC"]

function cityName(zone: string) {
  if (zone === "UTC" || zone === "Etc/UTC") return "UTC"
  return zone.split("/").pop()?.replaceAll("_", " ") ?? zone
}

function offsetLabel(zone: string) {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    )
  } catch {
    return ""
  }
}

let zoneCache: ZoneInfo[] | null = null

export function listTimezones(): ZoneInfo[] {
  if (zoneCache) return zoneCache
  zoneCache = ianaZones.map((id) => {
    const city = cityName(id)
    const region = id.includes("/") ? id.slice(0, id.indexOf("/")) : id
    const offset = offsetLabel(id)
    const alias = ALIASES[id] ?? ""
    return {
      id,
      city,
      region,
      offset,
      search: `${id} ${city} ${offset} ${offset.replace("GMT", "UTC")} ${alias}`.toLowerCase(),
    }
  })
  return zoneCache
}

function localZoneId() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

function groupByRegion(zones: ZoneInfo[]) {
  const map = new Map<string, ZoneInfo[]>()
  for (const zone of zones) {
    const list = map.get(zone.region)
    if (list) list.push(zone)
    else map.set(zone.region, [zone])
  }
  return [...map.entries()]
}

function ZoneItem({
  zone,
  selected,
  onSelect,
}: {
  zone: ZoneInfo
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <CommandItem
      value={zone.id}
      data-checked={selected || undefined}
      onSelect={() => onSelect(zone.id)}
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate">{zone.city}</span>
        <span className="text-muted-foreground truncate text-[11px]">{zone.id}</span>
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{zone.offset}</span>
    </CommandItem>
  )
}

export function TimezoneSelect({
  value,
  onChange,
  className,
}: {
  value?: string
  onChange?: (zone: string) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const t = useLabels("timezoneSelect")
  const zones = React.useMemo(() => listTimezones(), [])
  const selectedId = value ?? localZoneId()
  const selected = zones.find((zone) => zone.id === selectedId)

  const common = React.useMemo(() => {
    const local = localZoneId()
    const ids = [local, ...COMMON_IDS.filter((id) => id !== local)]
    return ids
      .map((id) => zones.find((zone) => zone.id === id))
      .filter((zone): zone is ZoneInfo => Boolean(zone))
  }, [zones])

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return null
    return zones.filter((zone) => zone.search.includes(needle)).slice(0, 80)
  }, [query, zones])

  const pick = (id: string) => {
    onChange?.(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-testid="timezone-select"
            aria-label={t.aria(selected?.city ?? selectedId)}
            className={cn("w-[240px] justify-between font-normal", className)}
          />
        }
      >
        <span className="truncate">
          {selected?.city ?? cityName(selectedId)}
          <span className="text-muted-foreground ml-1 text-xs tabular-nums">
            {selected?.offset ?? offsetLabel(selectedId)}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] overflow-hidden p-0">
        <Command shouldFilter={false} className="h-auto overflow-hidden">
          <CommandInput
            placeholder={t.search}
            value={query}
            onValueChange={setQuery}
            data-testid="timezone-search"
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{t.empty}</CommandEmpty>
            {matches ? (
              groupByRegion(matches).map(([region, items]) => (
                <CommandGroup key={region} heading={region}>
                  {items.map((zone) => (
                    <ZoneItem
                      key={zone.id}
                      zone={zone}
                      selected={zone.id === selectedId}
                      onSelect={pick}
                    />
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup heading={t.common}>
                {common.map((zone) => (
                  <ZoneItem
                    key={zone.id}
                    zone={zone}
                    selected={zone.id === selectedId}
                    onSelect={pick}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {!matches ? (
            <p className="text-muted-foreground border-t px-2.5 py-1.5 text-[11px]">
              {t.typeToSearch(zones.length)}
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
