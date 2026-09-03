import * as React from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, AspectRatio, Attachment, AttachmentContent, AttachmentDescription, AttachmentTitle, Avatar, AvatarFallback, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Bubble, BubbleContent, Button, ButtonGroup, Calendar, Card, CardContent, CardHeader, CardTitle, Collapsible, CollapsibleContent, CollapsibleTrigger, Empty, EmptyDescription, EmptyHeader, EmptyTitle, InputGroup, InputGroupAddon, InputGroupInput, Item, ItemContent, ItemDescription, ItemTitle, Kbd, Marker, MarkerContent, Message, MessageContent, Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Progress, ResizableHandle, ResizablePanel, ResizablePanelGroup, ScrollArea, Separator, Skeleton, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Toggle, ToggleGroup, ToggleGroupItem } from "@monkey-mini-app/ui";

import { Example } from "../shared/example";

export function PrimitiveExamples() {
  const [open, setOpen] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [align, setAlign] = React.useState("left");
  const [page, setPage] = React.useState(1);

  return (
    <>
      <Example id="button" title="Button / ButtonGroup">
        <div className="flex flex-wrap gap-2">
          <Button data-testid="primitive-button">Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <ButtonGroup>
            <Button variant="outline">One</Button>
            <Button variant="outline">Two</Button>
          </ButtonGroup>
        </div>
      </Example>
      <Example id="badge-avatar-kbd" title="Badge / Avatar / Kbd">
        <div className="flex items-center gap-2">
          <Badge>New</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Avatar className="size-8">
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <Kbd>⌘K</Kbd>
        </div>
      </Example>
      <Example id="alert-empty-skeleton" title="Alert / Empty / Skeleton / Spinner / Progress">
        <div className="flex max-w-lg flex-col gap-3">
          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Something needs attention.</AlertDescription>
          </Alert>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing here</EmptyTitle>
              <EmptyDescription>Create the first item.</EmptyDescription>
            </EmptyHeader>
          </Empty>
          <Skeleton className="h-6 w-48" />
          <Spinner />
          <Progress value={48} />
        </div>
      </Example>
      <Example id="tabs-accordion-collapsible" title="Tabs / Accordion / Collapsible">
        <div className="flex max-w-lg flex-col gap-4">
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First panel</TabsContent>
            <TabsContent value="two">Second panel</TabsContent>
          </Tabs>
          <Accordion>
            <AccordionItem value="a">
              <AccordionTrigger>What is this?</AccordionTrigger>
              <AccordionContent>An interactive accordion.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
              {open ? "Hide" : "Show"} extra
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-sm">Hidden details</CollapsibleContent>
          </Collapsible>
        </div>
      </Example>
      <Example id="toggle" title="Toggle / ToggleGroup">
        <div className="flex flex-wrap gap-3">
          <Toggle pressed={pressed} onPressedChange={setPressed}>
            Bold
          </Toggle>
          <ToggleGroup value={[align]} onValueChange={(v) => v[0] && setAlign(v[0])}>
            <ToggleGroupItem value="left">Left</ToggleGroupItem>
            <ToggleGroupItem value="center">Center</ToggleGroupItem>
            <ToggleGroupItem value="right">Right</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Example>
      <Example id="table-card-separator" title="Table / Card / Separator / Breadcrumb">
        <div className="flex max-w-lg flex-col gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Demo</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Card>
            <CardHeader>
              <CardTitle>Card</CardTitle>
            </CardHeader>
            <CardContent>Interactive container.</CardContent>
          </Card>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Col</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Row</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Example>
      <Example id="pagination" title="Pagination">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => p + 1); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Example>
      <Example id="chat-surface" title="Bubble / Marker / Attachment / Item">
        <div className="flex max-w-md flex-col gap-2">
          <Bubble>
            <BubbleContent>Can you rerun login-spec?</BubbleContent>
          </Bubble>
          <Marker>
            <MarkerContent>Explored 4 files</MarkerContent>
          </Marker>
          <Attachment>
            <AttachmentContent>
              <AttachmentTitle>report.pdf</AttachmentTitle>
              <AttachmentDescription>PDF · 120 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Notification</ItemTitle>
              <ItemDescription>Build finished</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      </Example>
      <Example id="aspect-ratio" title="AspectRatio">
        <div className="w-48">
          <AspectRatio ratio={16 / 9} className="rounded-lg bg-muted" />
        </div>
      </Example>
      <Example id="scroll-resizable" title="ScrollArea / Resizable / InputGroup / Calendar / Message">
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
      </Example>
    </>
  );
}
