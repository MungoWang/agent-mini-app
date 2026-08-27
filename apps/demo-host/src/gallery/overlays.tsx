import * as React from "react"
import { ConfirmDialog } from "@monkey-mini-app/ui/composites/confirm-dialog"
import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@monkey-mini-app/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@monkey-mini-app/ui/components/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui/components/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@monkey-mini-app/ui/components/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@monkey-mini-app/ui/components/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@monkey-mini-app/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@monkey-mini-app/ui/components/tooltip"
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from "@monkey-mini-app/ui/components/context-menu"
import { toast } from "@monkey-mini-app/ui/components/toast"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@monkey-mini-app/ui/components/command"
import { Example } from "./section"

export function OverlayExamples() {
  const [confirm, setConfirm] = React.useState(false)
  return (
    <>
      <Example id="dialog" title="Dialog">
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit run</DialogTitle>
              <DialogDescription>Change metadata and save.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </Example>
      <Example id="sheet-drawer" title="Sheet / Drawer">
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Inspector</SheetTitle>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Drawer</DrawerTitle>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>
        </div>
      </Example>
      <Example id="popover-tooltip-hover" title="Popover / Tooltip / HoverCard">
        <div className="flex flex-wrap gap-3">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>Popover</PopoverTrigger>
            <PopoverContent>Filter options</PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
          <HoverCard>
            <HoverCardTrigger render={<Button variant="ghost" />}>User</HoverCardTrigger>
            <HoverCardContent>Ada · QA</HoverCardContent>
          </HoverCard>
        </div>
      </Example>
      <Example id="menus" title="DropdownMenu / ContextMenu">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </Example>
      <Example id="command" title="Command">
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
      </Example>
      <Example id="confirm-toast" title="ConfirmDialog / Toast">
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Delete
          </Button>
          <Button variant="outline" onClick={() => toast.add({ title: "Saved", description: "Run updated." })}>
            Toast
          </Button>
        </div>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this run?"
          description="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => setConfirm(false)}
        />
      </Example>
    </>
  )
}
