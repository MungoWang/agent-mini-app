/**
 * @exampleOf Gantt
 * @title Gantt
 * @scenario Time-phased bars for planning (tasks against a date axis) where dependency order and overlap matter more than exact times.
 */
import { Gantt } from "@monkey-mini-app/ui";

export default function Gantt01Example() {
  return (
    <>
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
    </>
  );
}
