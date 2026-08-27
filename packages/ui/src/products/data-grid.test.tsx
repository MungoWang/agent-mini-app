import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ColumnDef } from "@tanstack/react-table"

import { DataGrid } from "./data-grid"

type Row = { id: string; name: string; status: string }

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "name",
    header: "Name",
    meta: { sort: true, search: "text", label: "Name" },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { sort: true, search: "text", label: "Status" },
  },
]

const data: Row[] = [
  { id: "1", name: "alpha", status: "pass" },
  { id: "2", name: "bravo", status: "fail" },
  { id: "3", name: "charlie", status: "pass" },
  { id: "4", name: "delta", status: "blocked" },
  { id: "5", name: "echo", status: "flaky" },
]

describe("DataGrid", () => {
  it("renders rows", () => {
    render(<DataGrid columns={columns} data={data} features={{ pagination: false }} />)
    expect(screen.getAllByTestId("data-grid-row")).toHaveLength(5)
  })

  it("filters by column search", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} data={data} features={{ pagination: false }} />)
    await user.click(screen.getByTestId("column-filter-name"))
    await user.type(screen.getByTestId("column-search-name"), "al")
    expect(screen.getAllByTestId("data-grid-row")).toHaveLength(1)
    expect(screen.getByText("alpha")).toBeInTheDocument()
  })

  it("filters by global search", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} data={data} features={{ pagination: false }} />)
    await user.type(screen.getByTestId("data-grid-global-search"), "fail")
    expect(screen.getAllByTestId("data-grid-row")).toHaveLength(1)
    expect(screen.getByText("bravo")).toBeInTheDocument()
  })

  it("sorts by header click", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} data={data} features={{ pagination: false }} />)
    await user.click(screen.getByTestId("sort-name"))
    const rows = screen.getAllByTestId("data-grid-row")
    expect(rows[0]).toHaveTextContent("alpha")
    await user.click(screen.getByTestId("sort-name"))
    const desc = screen.getAllByTestId("data-grid-row")
    expect(desc[0]).toHaveTextContent("echo")
    await user.click(screen.getByTestId("sort-name"))
    const reset = screen.getAllByTestId("data-grid-row")
    expect(reset[0]).toHaveTextContent("alpha")
    expect(reset[1]).toHaveTextContent("bravo")
  })

  it("paginates", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} data={data} pageSize={2} />)
    expect(screen.getAllByTestId("data-grid-row")).toHaveLength(2)
    expect(screen.getByTestId("data-grid-page")).toHaveTextContent("1 / 3")
    await user.click(screen.getByTestId("data-grid-next"))
    expect(screen.getByTestId("data-grid-page")).toHaveTextContent("2 / 3")
  })

  it("keeps the page when data reference changes with autoResetPageIndex off", () => {
    const { rerender } = render(
      <DataGrid
        columns={columns}
        data={data.slice(0, 2)}
        pageSize={1}
        features={{ autoResetPageIndex: false }}
        pageIndex={1}
        onPageIndexChange={() => {}}
      />
    )
    expect(screen.getByTestId("data-grid-page")).toHaveTextContent("2 / 2")
    rerender(
      <DataGrid
        columns={columns}
        data={data}
        pageSize={1}
        features={{ autoResetPageIndex: false }}
        pageIndex={1}
        onPageIndexChange={() => {}}
      />
    )
    expect(screen.getByTestId("data-grid-page")).toHaveTextContent("2 / 5")
  })

  it("fires onPageIndexChange when the user flips pages (controlled)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DataGrid
        columns={columns}
        data={data}
        pageSize={2}
        pageIndex={0}
        onPageIndexChange={onChange}
      />
    )
    await user.click(screen.getByTestId("data-grid-next"))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it("shows empty state", () => {
    render(<DataGrid columns={columns} data={[]} features={{ pagination: false }} />)
    expect(screen.getByTestId("data-grid-empty")).toHaveTextContent("No results")
  })

  it("opens the view menu without throwing", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} data={data} features={{ pagination: false }} />)
    await user.click(screen.getByRole("button", { name: /view/i }))
    expect(await screen.findByText("Columns")).toBeInTheDocument()
    expect(screen.getByRole("menuitemcheckbox", { name: /name/i })).toBeInTheDocument()
  })
})
