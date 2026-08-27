import { TreeView, type TreeNode } from "@monkey-mini-app/ui/products/tree-view"

export function FileTree({ nodes }: { nodes: TreeNode[] }) {
  return <TreeView nodes={nodes} />
}
