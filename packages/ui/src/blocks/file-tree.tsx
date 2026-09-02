import { TreeView, type TreeNode } from "@monkey-mini-app/ui/products/tree-view"

/**
 * Expandable file/dir tree (icons built in).
 * @when Repo/zip contents where selection matters. Plain nested list → `TreeView`.
 * @example
 * <FileTree nodes={[{ name: "src", children: [{ name: "main.api.ts" }] }]} />
 * @family Data & tables
 */
export function FileTree({ nodes }: { nodes: TreeNode[] }) {
  return <TreeView nodes={nodes} />
}
