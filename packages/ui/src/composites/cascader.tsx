"use client"

import { NativeSelect, NativeSelectOption } from "@monkey-mini-app/ui/components/native-select"

export type CascaderNode = { value: string; label: string; children?: CascaderNode[] }

export function Cascader({
  options,
  value = [],
  onChange,
}: {
  options: CascaderNode[]
  value?: string[]
  onChange?: (value: string[]) => void
}) {
  const columns: CascaderNode[][] = []
  let level = options
  columns.push(level)
  for (const key of value) {
    const next = level.find((node) => node.value === key)?.children
    if (!next?.length) break
    columns.push(next)
    level = next
  }
  return (
    <div className="flex flex-wrap gap-2" data-testid="cascader">
      {columns.map((nodes, index) => (
        <NativeSelect
          key={index}
          value={value[index] ?? ""}
          onChange={(event) => {
            const next = event.target.value
            onChange?.([...value.slice(0, index), next])
          }}
        >
          <NativeSelectOption value="">Select</NativeSelectOption>
          {nodes.map((node) => (
            <NativeSelectOption key={node.value} value={node.value}>
              {node.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ))}
    </div>
  )
}
