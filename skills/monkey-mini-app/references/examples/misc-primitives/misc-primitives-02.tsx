/**
 * @group primitives
 * @title Tabs / Accordion / Collapsible
 * @scenario Three ways to switch content in place — Tabs (parallel views), Accordion (stacked, multiple open), Collapsible (one region folded inside a card).
 */
import * as React from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from "@monkey-mini-app/ui";

const [open, setOpen] = React.useState(false);

const [pressed, setPressed] = React.useState(false);

const [align, setAlign] = React.useState("left");

const [page, setPage] = React.useState(1);

export default function MiscPrimitives02Example() {
  return (
    <>
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
    </>
  );
}
