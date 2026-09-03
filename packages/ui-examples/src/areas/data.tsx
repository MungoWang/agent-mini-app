import DataGrid01Example from "../components/data-grid/data-grid-01";
import DataGrid02Example from "../components/data-grid/data-grid-02";
import { Example } from "../shared/example";

export function DataExamples() {
  return (
    <>
      <Example id="data-grid" title="DataGrid" hint="Sort cycles asc → desc → none">
        <DataGrid01Example />
      </Example>
      <Example id="data-grid-custom" title="DataGrid · custom cells" hint="Avatar, progress, badges, row expand, selection, CSV">
        <DataGrid02Example />
      </Example>
    </>
  );
}
