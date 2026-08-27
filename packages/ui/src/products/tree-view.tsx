"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

export type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
}

function Node({
  node,
  depth,
}: {
  node: TreeNode
  depth: number
}) {
  const [open, setOpen] = React.useState(true)
  const hasChildren = Boolean(node.children?.length)
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted"
        style={{ paddingLeft: depth * 12 }}
        onClick={() => hasChildren && setOpen((value) => !value)}
      >
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition",
            hasChildren ? (open ? "rotate-90" : "") : "opacity-0"
          )}
        />
        {node.label}
      </button>
      {open && hasChildren
        ? node.children!.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} />
          ))
        : null}
    </div>
  )
}

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  return (
    <div data-testid="tree-view">
      {nodes.map((node) => (
        <Node key={node.id} node={node} depth={0} />
      ))}
    </div>
  )
}
