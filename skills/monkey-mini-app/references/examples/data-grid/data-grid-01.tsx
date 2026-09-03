/**
 * @exampleOf DataGrid
 * @title DataGrid
 * @scenario The default table for anything bigger than a static list: column sort (asc→desc→off), global search box, pagination — all from props, no external state library.
 * @hint Sort cycles asc → desc → none
 */
import { type ColumnDef, DataGrid, StatusBadge } from "@monkey-mini-app/ui";

type Run = { id: string; name: string; owner: string; duration: string; status: string };

const runs: Run[] = [
  { id: "1", name: "login-spec", owner: "Ada", duration: "1.2s", status: "pass" },
  { id: "2", name: "checkout-spec", owner: "Lin", duration: "4.8s", status: "fail" },
  { id: "3", name: "search-spec", owner: "Ada", duration: "0.9s", status: "pass" },
  { id: "4", name: "upload-spec", owner: "Kai", duration: "12.0s", status: "blocked" },
  { id: "5", name: "grid-spec", owner: "Lin", duration: "3.1s", status: "flaky" },
  { id: "6", name: "auth-spec", owner: "Kai", duration: "2.0s", status: "running" },
];

const columns: ColumnDef<Run>[] = [
  { accessorKey: "name", header: "Name", meta: { sort: true, search: "text" } },
  { accessorKey: "owner", header: "Owner", meta: { sort: true, search: "text" } },
  { accessorKey: "duration", header: "Duration", meta: { sort: true, search: "text" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: { sort: true, search: "text" },
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
];

export default function DataGrid01Example() {
  return <DataGrid columns={columns} data={runs} pageSize={4} searchPlaceholder="Search runs…" />;
}
