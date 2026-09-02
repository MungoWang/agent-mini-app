/**
 * Fixed-width console block.
 * @when Showing a command + its output verbatim. Timestamped levels/scrolling → `LogViewer`.
 * @example
 * <Terminal lines={["$ df -h", "/dev/disk1  62%"]} />
 * @family Realtime
 */
export function Terminal({ lines }: { lines: string[] }) {
  return (
    <pre
      data-testid="terminal"
      className="overflow-auto rounded-xl bg-zinc-950 p-3 font-mono text-xs leading-6 text-zinc-100"
    >
      {lines.join("\n")}
    </pre>
  )
}
