/**
 * @exampleOf Command
 * @title Command
 * @scenario Cmd-K style palette: fuzzy input over grouped actions with an empty state, mounted inline rather than as a dialog.
 */
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@monkey-mini-app/ui";

export default function Command01Example() {
  return (
    <>
      <Command className="h-40 w-72 rounded-xl border">
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup>
            <CommandItem>Open grid</CommandItem>
            <CommandItem>New run</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </>
  );
}
