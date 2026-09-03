/**
 * @exampleOf Pagination
 * @title Pagination
 * @scenario Numbered page nav with prev/next and an active page, driven by your own state; DataGrid already includes this when you need a full table.
 */
import * as React from "react";

import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@monkey-mini-app/ui";

const [open, setOpen] = React.useState(false);

const [pressed, setPressed] = React.useState(false);

const [align, setAlign] = React.useState("left");

const [page, setPage] = React.useState(1);

export default function Pagination01Example() {
  return (
    <>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => p + 1); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
    </>
  );
}
