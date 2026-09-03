/**
 * @exampleOf Item
 * @title Item
 * @scenario A uniform row (title + description + trailing actions) inside menus, lists and cards, with an outline variant for grouping.
 */
import { Item, ItemContent, ItemDescription, ItemTitle } from "@monkey-mini-app/ui";

export default function Item01Example() {
  return (
    <>
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Notification</ItemTitle>
          <ItemDescription>Build finished</ItemDescription>
        </ItemContent>
      </Item>
    </>
  );
}
