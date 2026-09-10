import { cn } from "@monkey-mini-app/ui/lib/utils";

/**
 * Fixed-width console block.
 * @when Showing a command + its output verbatim. Timestamped levels/scrolling → `LogViewer`.
 * @example
 * <Terminal lines={["$ df -h", "/dev/disk1  62%"]} />
 * @family Realtime
 */
export function Terminal({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <pre
      data-testid="terminal"
      className={cn(
        "overflow-auto rounded-xl bg-zinc-950 p-3 font-mono text-xs leading-6 text-zinc-100",
        className,
      )}
    >
      {lines.join("\n")}
    </pre>
  );
}
