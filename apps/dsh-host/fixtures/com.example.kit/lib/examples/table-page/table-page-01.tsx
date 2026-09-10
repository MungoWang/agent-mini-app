/**
 * @exampleOf TablePage
 * @title TablePage
 * @scenario A wide table as the whole product: the filter bar stays pinned, only the grid scrolls, and ticking rows floats a bulk bar over the bottom without moving a single row.
 * @hint Scroll the table — the toolbar stays put; select rows — the bar floats over the grid, it never pushes rows down
 */
import * as React from "react";

import { Checkbox, type ColumnDef, DataGrid, Input, TablePage } from "@monkey-mini-app/ui";

type Part = { sku: string; name: string; bin: string; qty: number };

const PARTS: Part[] = Array.from({ length: 60 }, (_, i) => ({
  sku: `SKU-${2400 - i}`,
  name: [
    "Bracket, left-hand",
    "Seal kit, 40 mm",
    "Harness, 2 m shielded",
    "Bearing, sealed 6204",
    "Label cartridge, black",
  ][i % 5],
  bin: `${String.fromCharCode(65 + (i % 6))}-${(i % 24) + 1}`,
  qty: ((i * 37) % 480) + 4,
}));

export default function TablePage01Example() {
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Record<string, boolean>>({});

  const rows = PARTS.filter(
    (p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.includes(query),
  );
  const count = Object.values(picked).filter(Boolean).length;
  const allPicked = rows.length > 0 && rows.every((p) => picked[p.sku]);

  const columns: ColumnDef<Part>[] = React.useMemo(
    () => [
      {
        id: "pick",
        header: () => (
          <Checkbox
            checked={allPicked}
            onCheckedChange={(v) =>
              setPicked(v === true ? Object.fromEntries(rows.map((p) => [p.sku, true])) : {})
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={Boolean(picked[row.original.sku])}
            onCheckedChange={(v) => setPicked((s) => ({ ...s, [row.original.sku]: v === true }))}
            aria-label={`Pick ${row.original.sku}`}
          />
        ),
      },
      { accessorKey: "sku", header: "SKU", meta: { sort: true } },
      { accessorKey: "name", header: "Part" },
      { accessorKey: "bin", header: "Bin", meta: { sort: true } },
      { accessorKey: "qty", header: "Qty", meta: { sort: true } },
    ],
    [allPicked, picked, rows],
  );

  return (
    <div className="h-[440px]">
      <TablePage
        toolbar={
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by part or SKU…"
              className="h-8 max-w-xs"
            />
            <span className="text-muted-foreground text-xs tabular-nums">{rows.length} rows</span>
          </div>
        }
        grid={<DataGrid columns={columns} data={rows} pageSize={12} features={{ pagination: true }} />}
        bulk={
          count > 0 ? (
            <div className="bg-card border-border flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg">
              <span className="tabular-nums font-medium">{count} selected</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                Export
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                onClick={() => setPicked({})}
              >
                Clear
              </button>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
