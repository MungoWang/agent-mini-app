/**
 * @exampleOf Table
 * @title Table
 * @scenario Static, semantic table you lay out by hand — small fixed datasets; switch to DataGrid the moment you need sort/filter/pagination.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@monkey-mini-app/ui";

export default function Table01Example() {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Col</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Row</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}
