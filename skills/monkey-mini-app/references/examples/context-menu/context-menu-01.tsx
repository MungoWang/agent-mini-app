/**
 * @exampleOf ContextMenu
 * @title ContextMenu
 * @scenario Right-click menu bound to a region (a row, a canvas cell) with grouped items and separators.
 */
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@monkey-mini-app/ui";

export default function ContextMenu01Example() {
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="rounded-lg border px-3 py-6 text-sm">
          Right click here
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem>Inspect</ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
