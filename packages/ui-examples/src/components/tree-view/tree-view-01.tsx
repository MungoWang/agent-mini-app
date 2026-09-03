/**
 * @exampleOf TreeView
 * @title TreeView
 * @scenario Nested hierarchy with expand/collapse and selection — file tree, org chart, category taxonomy.
 */
import { TreeView } from "@monkey-mini-app/ui";

export default function TreeView01Example() {
  return (
    <>
      <TreeView
        nodes={[
          {
            id: "src",
            label: "src",
            children: [
              { id: "app", label: "App.tsx" },
              { id: "ui", label: "ui.ts" },
            ],
          },
        ]}
      />
    </>
  );
}
