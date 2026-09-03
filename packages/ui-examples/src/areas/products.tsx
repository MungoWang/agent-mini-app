import * as React from "react";

import { type CalendarEvent, CodeBlock, DiffViewer, EventCalendar, FileDropzone, Gantt, JsonViewer, Kanban, type KanbanCard, KanbanIssuePanel, LogViewer, type SortableItem, SortableList, Stepper, StepperItem, Timeline, TreeView } from "@monkey-mini-app/ui";

import { Example } from "../shared/example";

export function ProductExamples() {
  const [step, setStep] = React.useState(1);
  const [files, setFiles] = React.useState<File[]>([]);
  const [items, setItems] = React.useState<SortableItem[]>([
    { id: "1", label: "Alpha" },
    { id: "2", label: "Bravo" },
    { id: "3", label: "Charlie" },
  ]);
  const [cards, setCards] = React.useState<KanbanCard[]>([
    {
      id: "c1",
      key: "TMS-1201",
      title: "Fix grid sort reset",
      columnId: "todo",
      type: "Story",
      status: "running",
      priority: "P1",
      assignee: "Ada",
      reporter: "Lin",
      tags: ["grid"],
      description: "Third click should clear sorting.",
      comments: [{ id: "1", author: "Lin", body: "Please add UT.", time: "1h" }],
    },
    {
      id: "c2",
      key: "TMS-1208",
      title: "Write board tests",
      columnId: "doing",
      type: "Task",
      status: "pass",
      priority: "P2",
      assignee: "Kai",
    },
  ]);
  const [issue, setIssue] = React.useState<KanbanCard | null>(null);
  const calUser = { id: "u1", name: "Ada", picturePath: null };
  const [events, setEvents] = React.useState<CalendarEvent[]>([
    {
      id: 1,
      title: "Release freeze",
      startDate: "2026-08-26T10:00:00",
      endDate: "2026-08-26T11:30:00",
      color: "blue",
      description: "",
      user: calUser,
    },
    {
      id: 2,
      title: "QA sync",
      startDate: "2026-08-26T10:30:00",
      endDate: "2026-08-26T11:00:00",
      color: "orange",
      description: "",
      user: calUser,
    },
    {
      id: 3,
      title: "Oncall",
      startDate: "2026-08-26T00:00:00",
      endDate: "2026-08-28T00:00:00",
      color: "green",
      description: "coverage",
      user: calUser,
    },
    {
      id: 4,
      title: "Design review",
      startDate: "2026-08-27T14:00:00",
      endDate: "2026-08-27T15:00:00",
      color: "purple",
      description: "",
      user: calUser,
    },
  ]);

  return (
    <>
      <Example id="stepper" title="Stepper" hint="Vertical and horizontal">
        <div className="flex flex-col gap-6">
          <Stepper>
            <StepperItem
              title="Draft"
              description="Write the change"
              status={step > 0 ? "completed" : "active"}
            />
            <StepperItem
              title="Review"
              description="QA sign-off"
              status={step > 1 ? "completed" : step === 1 ? "active" : "default"}
            />
            <StepperItem
              title="Done"
              description="Shipped"
              status={step >= 2 ? "active" : "default"}
            />
          </Stepper>
          <Stepper orientation="horizontal">
            <StepperItem title="Draft" status={step > 0 ? "completed" : "active"} />
            <StepperItem title="Review" status={step > 1 ? "completed" : step === 1 ? "active" : "default"} />
            <StepperItem title="Done" status={step >= 2 ? "active" : "default"} />
          </Stepper>
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={() => setStep((s) => (s + 1) % 3)}>
          Next step
        </button>
      </Example>
      <Example id="timeline" title="Timeline">
        <Timeline
          items={[
            { id: "1", title: "Opened", time: "10:00" },
            { id: "2", title: "Running", time: "10:02" },
            { id: "3", title: "Passed", time: "10:04" },
          ]}
        />
      </Example>
      <Example id="tree-sortable" title="TreeView / SortableList">
        <div className="grid gap-4 md:grid-cols-2">
          <TreeView
            nodes={[
              {
                id: "src",
                label: "src",
                children: [
                  { id: "app", label: "App.tsx" },
                  { id: "ui", label: "ui.ts" },
                ],
              },
            ]}
          />
          <SortableList items={items} onChange={setItems} />
        </div>
      </Example>
      <Example id="kanban" title="Kanban" hint="Drag between columns · click a card for Jira details">
        <Kanban
          columns={[
            { id: "todo", title: "Todo" },
            { id: "doing", title: "Doing", limit: 3 },
            { id: "done", title: "Done" },
          ]}
          cards={cards}
          onCardsChange={setCards}
          onCardClick={setIssue}
        />
        <KanbanIssuePanel
          card={issue}
          open={issue != null}
          onOpenChange={(open) => !open && setIssue(null)}
          columnTitle={cards.find((c) => c.id === issue?.id)?.columnId}
        />
      </Example>
      <Example id="calendar-gantt" title="EventCalendar / Gantt" hint="Drag days or hours to create · All day uses date range picker">
        <div className="flex flex-col gap-4">
          <EventCalendar events={events} onEventsChange={setEvents} view="month" />
          <Gantt
            tasks={[
              {
                id: "t1",
                title: "Grid",
                start: new Date("2026-08-01"),
                end: new Date("2026-08-10"),
              },
              {
                id: "t2",
                title: "Demo",
                start: new Date("2026-08-08"),
                end: new Date("2026-08-20"),
              },
            ]}
          />
        </div>
      </Example>
      <Example id="dropzone" title="FileDropzone">
        <FileDropzone files={files} onFiles={setFiles} />
      </Example>
      <Example id="inspectors" title="DiffViewer / JsonViewer / CodeBlock / LogViewer">
        <div className="flex flex-col gap-3">
          <DiffViewer original={"a\nb\n"} modified={"a\nc\n"} />
          <JsonViewer value={{ ok: true, count: 2, nested: { a: 1 } }} />
          <CodeBlock
            language="ts"
            code={`type Run = { id: string }\nexport const run: Run = { id: \"1\" }\n`}
          />
          <LogViewer
            entries={Array.from({ length: 40 }, (_, i) => ({
              level: (["info", "warn", "error", "debug", "verbose"] as const)[i % 5],
              message: `line ${i}`,
              timestamp: new Date(2026, 0, 1, 12, 0, i % 60).toISOString(),
            }))}
          />
        </div>
      </Example>
    </>
  );
}
