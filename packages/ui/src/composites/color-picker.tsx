"use client"

export function ColorPicker({
  value = "#111111",
  onChange,
}: {
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <input
      data-testid="color-picker"
      type="color"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5"
    />
  )
}
