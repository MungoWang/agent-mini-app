/**
 * @group primitives
 * @title ScrollArea / Resizable / InputGroup / Calendar / Message
 * @scenario Layout primitives that fight resizing: ScrollArea (custom, fixed-height), Resizable split panes (orientation + min size), InputGroup (addon prefix + icon).
 */
import {
  Calendar,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Message,
  MessageContent,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
} from "@monkey-mini-app/ui";

export default function MiscPrimitives03Example() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <ScrollArea className="h-24 rounded-lg border p-2 text-sm">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i}>Row {i + 1}</div>
          ))}
        </ScrollArea>
        <ResizablePanelGroup orientation="horizontal" className="min-h-24 rounded-lg border">
          <ResizablePanel defaultSize={50}>Left</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>Right</ResizablePanel>
        </ResizablePanelGroup>
        <InputGroup className="max-w-xs">
          <InputGroupAddon>@</InputGroupAddon>
          <InputGroupInput placeholder="username" />
        </InputGroup>
        <Calendar mode="single" />
        <Message>
          <MessageContent>Assistant reply</MessageContent>
        </Message>
      </div>
    </>
  );
}
