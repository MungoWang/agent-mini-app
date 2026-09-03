/**
 * @group charts-blocks
 * @title PageHeader / FilterBar
 * @scenario Page chrome working together: PageHeader (title + description + primary action) with a FilterBar row beneath — the standard screen top for list/monitor pages.
 */
import { Button, FilterBar, Input, PageHeader } from "@monkey-mini-app/ui";

export default function MiscChartsBlocks01Example() {
  return (
    <>
        <PageHeader title="QA Runs" description="Latest CI" actions={<Button size="sm">New</Button>} />
        <FilterBar>
          <Input placeholder="Filter…" className="max-w-xs" />
          <Button variant="outline" size="sm">Apply</Button>
        </FilterBar>
    </>
  );
}
