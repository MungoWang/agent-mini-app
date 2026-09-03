/**
 * @exampleOf Empty
 * @title Empty
 * @scenario First-run / no-results state with illustration slot, title, description and a primary action; use instead of a blank card.
 */
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@monkey-mini-app/ui";

export default function Empty01Example() {
  return (
    <>
<Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing here</EmptyTitle>
              <EmptyDescription>Create the first item.</EmptyDescription>
            </EmptyHeader>
          </Empty>
    </>
  );
}
