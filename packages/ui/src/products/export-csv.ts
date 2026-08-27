export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename = "export.csv"
) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((key) => {
          const raw = String(row[key] ?? "")
          return `"${raw.replaceAll('"', '""')}"`
        })
        .join(",")
    ),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
