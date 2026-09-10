import Command01Example from "../components/command/command-01";
import ConfirmDialog01Example from "../components/confirm-dialog/confirm-dialog-01";
import ContextMenu01Example from "../components/context-menu/context-menu-01";
import Dialog01Example from "../components/dialog/dialog-01";
import DropdownMenu01Example from "../components/dropdown-menu/dropdown-menu-01";
import FormSheet01Example from "../components/form-sheet/form-sheet-01";
import MiscOverlays01Example from "../components/misc-overlays/misc-overlays-01";
import MiscOverlays02Example from "../components/misc-overlays/misc-overlays-02";
import { Example } from "../shared/example";

export function OverlayExamples() {
  return (
    <>
      <Example
        id="form-sheet"
        title="FormSheet"
        hint="Change a field, then press Escape — the discard prompt appears; without a change it closes straight away"
      >
        <FormSheet01Example />
      </Example>
      <Example id="dialog" title="Dialog">
        <Dialog01Example />
      </Example>
      <Example id="sheet-drawer" title="Sheet / Drawer">
        <MiscOverlays01Example />
      </Example>
      <Example id="popover-tooltip-hover" title="Popover / Tooltip / HoverCard">
        <MiscOverlays02Example />
      </Example>
      <Example id="menus-dropdown-menu" title="DropdownMenu">
        <DropdownMenu01Example />
      </Example>
      <Example id="menus-context-menu" title="ContextMenu">
        <ContextMenu01Example />
      </Example>
      <Example id="command" title="Command">
        <Command01Example />
      </Example>
      <Example id="confirm-toast" title="ConfirmDialog / Toast">
        <ConfirmDialog01Example />
      </Example>
    </>
  );
}
