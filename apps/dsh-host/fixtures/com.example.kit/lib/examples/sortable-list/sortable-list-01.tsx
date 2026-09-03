/**
 * @exampleOf SortableList
 * @title SortableList
 * @scenario Reorder by drag with the new order pushed back to state — priorities, playbooks, column order.
 */
import * as React from "react";

import { type SortableItem, SortableList } from "@monkey-mini-app/ui";

export default function SortableList01Example() {
  const [items, setItems] = React.useState<SortableItem[]>([
    { id: "1", label: "Alpha" },
    { id: "2", label: "Bravo" },
    { id: "3", label: "Charlie" },
  ]);

  return <SortableList items={items} onChange={setItems} />;
}
