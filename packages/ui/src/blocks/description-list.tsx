/**
 * Label/value pairs, two columns.
 * @when Detail/inspector panel of a selected row — the default “show one record” view.
 * @example
 * <DescriptionList items={[{ label: "状态", value: "运行中" }]} />
 * @family Layout & structure
 */
export function DescriptionList({
  items,
}: {
  items: { label: string; value: string }[]
}) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm" data-testid="description-list">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
