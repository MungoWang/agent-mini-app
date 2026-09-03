/**
 * @exampleOf DropdownMenu
 * @title DropdownMenu
 * @scenario Click-to-open action menu on a button, with groups, labels and shortcut hints; for row-level 'more actions'.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui";

export default function DropdownMenu01Example() {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Copy</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
