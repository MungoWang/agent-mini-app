/**
 * @group overlays
 * @title Popover / Tooltip / HoverCard
 * @scenario Hover/click surfaces ranked by commitment: Popover (anchored editor, e.g. filters), Tooltip (short read-only label), HoverCard (preview of a referenced record).
 */
import { Button, HoverCard, HoverCardContent, HoverCardTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@monkey-mini-app/ui";

export default function MiscOverlays02Example() {
  return (
    <>
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
    </>
  );
}
