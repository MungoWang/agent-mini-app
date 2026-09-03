/**
 * @exampleOf EventCalendar
 * @title EventCalendar
 * @scenario Month view of events the user can drag/resize, with the model kept in app state via onEventsChange.
 */
import * as React from "react";

import { type CalendarEvent, EventCalendar } from "@monkey-mini-app/ui";

const calUser = { id: "u1", name: "Ada", picturePath: null };

export default function EventCalendar01Example() {
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

  return <EventCalendar events={events} onEventsChange={setEvents} view="month" />;
}
