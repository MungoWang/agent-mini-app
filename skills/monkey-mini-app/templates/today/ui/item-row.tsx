import { Badge } from "@monkey-mini-app/ui";

export type Item = { id: string; title: string; done: boolean; createdAt: number };

/** UI-only row. Backend must not import ./ui/**. */
export function ItemRow({
  item,
  selected,
  onSelect,
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${selected ? "bg-muted" : ""}`}
      onClick={onSelect}
    >
      <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.title}</span>
      {item.done ? <Badge variant="secondary">完</Badge> : null}
    </button>
  );
}
