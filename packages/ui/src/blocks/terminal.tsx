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
