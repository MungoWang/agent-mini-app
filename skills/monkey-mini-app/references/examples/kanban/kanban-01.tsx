/**
 * @exampleOf Kanban
 * @title Kanban
 * @scenario Card board with drag between columns, plus the issue detail sheet — the workflow/pipeline view; use Table/DataGrid when you need sorting and totals.
 * @hint Drag between columns · click a card for Jira details
 */
import * as React from "react";

import { Kanban, type KanbanCard, KanbanIssuePanel } from "@monkey-mini-app/ui";

export default function Kanban01Example() {
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

  return (
    <>
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
    </>
  );
}
