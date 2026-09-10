import type { Payload } from "../shared/events";

/**
 * UI-only. The brief is an article, not a card: kicker → serif display → numbered bullets,
 * limited measure. That is the whole `editorial` grammar (references/looks/editorial.md).
 */
export function Brief({ data, stale }: { data: Payload | null; stale: boolean }) {
  const digest = data?.digest;
  return (
    <article className="max-w-2xl">
      <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
        本期简报 {data?.at ? `· ${new Date(data.at).toLocaleDateString("zh-CN")}` : ""}
      </p>
      <h2 className="mt-3 font-serif text-3xl leading-snug font-bold tracking-tight">
        {digest ? digest.headline : stale ? "还没有简报，点右上角整理一次" : "正在整理…"}
      </h2>
      {digest?.bullets?.length ? (
        <ol className="text-muted-foreground mt-6 flex list-none flex-col gap-4 p-0">
          {digest.bullets.map((b, i) => (
            <li key={i} className="flex gap-4 text-sm leading-relaxed">
              <span className="text-primary font-mono text-xs tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-foreground">{b}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
