import type { DataGridColumnMeta } from "./data-grid"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> extends DataGridColumnMeta {
    _unused?: TValue | TData
  }
}

export {}
