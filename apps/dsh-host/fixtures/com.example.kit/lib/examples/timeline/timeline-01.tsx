/**
 * @exampleOf Timeline
 * @title Timeline
 * @scenario Chronological feed of events with actor + timestamp — deploy history, audit trail (compare RunTimeline for one job's steps).
 */
import * as React from "react";

import { type CalendarEvent, type KanbanCard, type SortableItem, Timeline } from "@monkey-mini-app/ui";

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

export default function Timeline01Example() {
  return (
    <>
      <Timeline
        items={[
          { id: "1", title: "Opened", time: "10:00" },
          { id: "2", title: "Running", time: "10:02" },
          { id: "3", title: "Passed", time: "10:04" },
        ]}
      />
    </>
  );
}
