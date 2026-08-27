import type { ReactNode } from "react"

/**
 * Horizontal wrap row for filters and toolbar controls.
 * @when Above DataGrid or any filtered list
 * @example
 * <FilterBar>
 *   <DateRangePicker value={range} onChange={setRange} />
 *   <SearchInput value={q} onChange={setQ} />
 * </FilterBar>
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="filter-bar"
    >
      {children}
    </div>
  )
}
