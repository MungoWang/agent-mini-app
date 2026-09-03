/**
 * @exampleOf DataGrid
 * @title Read-only grid with a column def
 *
 * Portable example. `ColumnDef` is a type the bare UI package re-exports.
 */
import { type ColumnDef,DataGrid } from "@monkey-mini-app/ui";

type Row = { name: string; count: number }

const rows: Row[] = [
  { name: "alpha", count: 3 },
  { name: "beta", count: 7 },
];

export default function Example() {
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "count", header: "Count" },
  ];
  return <DataGrid columns={columns} data={rows} />;
}
