import { useState } from "react";

import { cn, useApp } from "@monkey-mini-app/sdk";

import { SECTIONS, type SectionId } from "./lib/data";
import {
  BoardsSection,
  ChartsSection,
  DataSection,
  DatesSection,
  EditorsSection,
  FormsSection,
  OverviewSection,
} from "./lib/sections";

function SectionBody({ id }: { id: SectionId }) {
  switch (id) {
    case "overview":
      return <OverviewSection />;
    case "forms":
      return <FormsSection />;
    case "dates":
      return <DatesSection />;
    case "data":
      return <DataSection />;
    case "editors":
      return <EditorsSection />;
    case "boards":
      return <BoardsSection />;
    case "charts":
      return <ChartsSection />;
    default:
      return null;
  }
}

export default function Ui() {
  useApp();
  const [section, setSection] = useState<SectionId>("overview");
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="bg-background flex h-full min-h-0 w-full" data-testid="kit-app">
      {/* Sidebar: brand row shares h-14 with content header so the top rule lines up */}
      <aside className="bg-sidebar text-sidebar-foreground flex w-52 shrink-0 flex-col border-r">
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <div className="text-sm font-medium tracking-tight">组件库</div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2" data-testid="kit-nav">
          {SECTIONS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`kit-nav-${item.id}`}
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex h-9 w-full items-center rounded-md px-3 text-left text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b px-6">
          <div className="min-w-0">
            <h1 className="font-heading text-base font-medium leading-none">{current.label}</h1>
            <p className="text-muted-foreground mt-1 text-xs leading-none">{current.hint}</p>
          </div>
        </header>
        <main
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          data-testid={`kit-section-${section}`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-5">
            <SectionBody id={section} />
          </div>
        </main>
      </div>
    </div>
  );
}
