/**
 * @exampleOf LogViewer
 * @title LogViewer
 * @scenario Thousands of streamed log lines: virtualised rows with level colouring and auto-follow; never render logs with a plain map.
 */
import { LogViewer } from "@monkey-mini-app/ui";

export default function LogViewer01Example() {
  return (
    <>
<LogViewer
            entries={Array.from({ length: 40 }, (_, i) => ({
              level: (["info", "warn", "error", "debug", "verbose"] as const)[i % 5],
              message: `line ${i}`,
              timestamp: new Date(2026, 0, 1, 12, 0, i % 60).toISOString(),
            }))}
          />
    </>
  );
}
