/**
 * @exampleOf ListDetail
 * @title ListDetail
 * @scenario Records browser at a fixed height: a long ticket list on the left, the selected ticket on the right, each pane scrolling on its own.
 * @hint Scroll either pane — the toolbar and the other pane stay put
 */
import * as React from "react";

import { Badge, Button, Input, ListDetail } from "@monkey-mini-app/ui";

type Ticket = {
  id: string;
  title: string;
  status: "Open" | "InProgress" | "Blocked";
  owner: string;
  updated: string;
};

const TICKETS: Ticket[] = Array.from({ length: 40 }, (_, i) => ({
  id: `OPS-${1040 - i}`,
  title: [
    "Nightly export drops the last sheet",
    "Queue depth alarm fires on restart",
    "Retry button re-sends twice",
    "Timezone shifts in the weekly digest",
    "Attachment preview stalls on large PDFs",
  ][i % 5],
  status: (["Open", "InProgress", "Blocked"] as const)[i % 3],
  owner: ["amy", "bo", "cy", "dee"][i % 4],
  updated: `${(i % 9) + 1}h ago`,
}));

export default function ListDetail01Example() {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<"list" | "detail">("list");

  const rows = TICKETS.filter((t) => (t.title + t.id).toLowerCase().includes(query.toLowerCase()));
  const current = rows.find((t) => t.id === selected) ?? null;

  return (
    <div className="h-[420px]">
      <ListDetail
        toolbar={
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickets"
              className="h-8 max-w-60"
            />
            <Badge variant="outline">
              {rows.length} of {TICKETS.length}
            </Badge>
          </div>
        }
        list={
          <ul className="divide-border divide-y">
            {rows.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(t.id);
                    setMobileView("detail");
                  }}
                  className={`hover:bg-muted/60 flex w-full flex-col items-start gap-1 px-3 py-2 text-left ${
                    t.id === selected ? "bg-muted" : ""
                  }`}
                >
                  <span className="text-muted-foreground font-mono text-xs">{t.id}</span>
                  <span className="text-sm">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        }
        detail={
          current ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{current.id}</span>
                <Badge>{current.status}</Badge>
              </div>
              <h3 className="font-heading font-medium">{current.title}</h3>
              <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt>Owner</dt>
                <dd>{current.owner}</dd>
                <dt>Updated</dt>
                <dd>{current.updated}</dd>
              </dl>
              <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                {Array.from({ length: 30 }, (_, i) => (
                  <li key={i}>
                    Activity {i + 1}: {current.owner} touched {current.id}
                  </li>
                ))}
              </ul>
              <div>
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  Clear selection
                </Button>
              </div>
            </div>
          ) : undefined
        }
        empty={
          <div className="text-muted-foreground p-6 text-sm">
            Select a ticket on the left. Both panes scroll independently — this one included.
          </div>
        }
        mobileView={mobileView}
        onMobileBack={() => setMobileView("list")}
      />
    </div>
  );
}
