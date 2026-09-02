"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { UiMessages } from "@monkey-mini-app/ui/i18n/en";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@monkey-mini-app/ui/components/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover";
import { useDateLocale, useLabels } from "@monkey-mini-app/ui/i18n/context";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type CommitAuthor = {
  name: string;
  avatarUrl?: string;
};

export type Commit = {
  /** Commit hash (full or abbreviated). */
  hash: string;
  /** Commit message (first line). */
  message: string;
  /** Commit author. */
  author: CommitAuthor;
  /** ISO date string or Date object. */
  date: string | Date;
  /** Parent commit hashes. Empty for root commits. Two parents = merge commit. */
  parents: string[];
  /** Branch or ref label (e.g. "main", "feat/auth"). */
  refs?: string[];
  /** Tag label (e.g. "v1.0.0"). */
  tag?: string;
};

export type CommitGraphProps = Omit<ComponentProps<"div">, "children"> & {
  /** Commits in topological order (newest first). Each commit includes parent hashes. */
  commits: Commit[];
  /** Number of hash characters to display. @default 7 */
  truncateHash?: number;
  /** Pixel width per rail column. @default 24 */
  railWidth?: number;
};

const RAIL_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

function color(rail: number): string {
  return RAIL_COLORS[rail % RAIL_COLORS.length] ?? "#3b82f6";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Graph layout computation

type GraphRow = {
  commit: Commit;
  rail: number;
  rails: (string | null)[];
  edges: Edge[];
};

type Edge = {
  fromRail: number;
  toRail: number;
  color: string;
  type: "straight" | "merge-in" | "fork-out";
};

function computeLayout(commits: Commit[]): GraphRow[] {
  const rows: GraphRow[] = [];
  // Active rails: each slot holds the hash of the commit it's "waiting for"
  const rails: (string | null)[] = [];

  for (const commit of commits) {
    const hash = commit.hash;

    // Find which rail this commit occupies (if any rail is waiting for it)
    let commitRail = rails.indexOf(hash);

    if (commitRail === -1) {
      // New branch — find first empty slot or append
      const emptySlot = rails.indexOf(null);
      if (emptySlot !== -1) {
        commitRail = emptySlot;
        rails[commitRail] = hash;
      } else {
        commitRail = rails.length;
        rails.push(hash);
      }
    }

    const commitColor = color(commitRail);
    const edges: Edge[] = [];

    // Draw straight lines for all other active rails (pass-through)
    for (let r = 0; r < rails.length; r++) {
      if (r !== commitRail && rails[r] !== null) {
        edges.push({
          fromRail: r,
          toRail: r,
          color: color(r),
          type: "straight",
        });
      }
    }

    // Clear this rail — the commit has been rendered
    rails[commitRail] = null;

    // Process parents
    const parents = commit.parents;
    const firstParent = parents[0];
    if (firstParent !== undefined) {
      // First parent continues on the same rail
      const existingRail = rails.indexOf(firstParent);
      if (existingRail !== -1) {
        // Parent already expected on another rail — merge line
        edges.push({
          fromRail: commitRail,
          toRail: existingRail,
          color: commitColor,
          type: "merge-in",
        });
      } else {
        // Parent takes this commit's rail
        rails[commitRail] = firstParent;
        edges.push({
          fromRail: commitRail,
          toRail: commitRail,
          color: commitColor,
          type: "straight",
        });
      }
    }

    // Second+ parents (merge sources)
    for (let p = 1; p < parents.length; p++) {
      const parentHash = parents[p];
      if (parentHash === undefined) continue;
      const existingRail = rails.indexOf(parentHash);
      if (existingRail !== -1) {
        // Already on a rail — draw merge line from that rail
        edges.push({
          fromRail: existingRail,
          toRail: commitRail,
          color: color(existingRail),
          type: "merge-in",
        });
      } else {
        // Needs a new rail — fork out
        const emptySlot = rails.indexOf(null);
        const newRail = emptySlot !== -1 ? emptySlot : rails.length;
        if (newRail >= rails.length) rails.push(null);
        rails[newRail] = parentHash;
        edges.push({
          fromRail: commitRail,
          toRail: newRail,
          color: color(newRail),
          type: "fork-out",
        });
      }
    }

    // Trim trailing nulls
    while (rails.length > 0 && rails[rails.length - 1] === null) {
      rails.pop();
    }

    rows.push({
      commit,
      rail: commitRail,
      rails: [...rails],
      edges,
    });
  }

  return rows;
}

// SVG rendering for rails

const ROW_HEIGHT = 40;

function RailsSVG({
  row,
  prevRow,
  railWidth,
  maxRails,
}: {
  row: GraphRow;
  prevRow: GraphRow | null;
  railWidth: number;
  maxRails: number;
}) {
  const w = maxRails * railWidth;
  const h = ROW_HEIGHT;
  const cy = h / 2;

  function rx(rail: number) {
    return rail * railWidth + railWidth / 2;
  }

  const commitX = rx(row.rail);

  // Collect which rails are active above this row (from previous row's post-state)
  const activeAbove = new Set<number>();
  if (prevRow) {
    for (let r = 0; r < prevRow.rails.length; r++) {
      if (prevRow.rails[r] !== null) activeAbove.add(r);
    }
  }

  // Collect which rails are active below this row
  const activeBelow = new Set<number>();
  for (let r = 0; r < row.rails.length; r++) {
    if (row.rails[r] !== null) activeBelow.add(r);
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Pass-through rails */}
      {Array.from(activeAbove).map((r) => {
        if (r === row.rail) return null;
        if (!activeBelow.has(r)) return null;
        const x = rx(r);
        return (
          <line
            key={`pt-${r}`}
            x1={x}
            y1={0}
            x2={x}
            y2={h}
            stroke={color(r)}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        );
      })}

      {/* Commit rail: incoming line (top to dot) */}
      {activeAbove.has(row.rail) && (
        <line
          x1={commitX}
          y1={0}
          x2={commitX}
          y2={cy}
          stroke={color(row.rail)}
          strokeWidth={2}
          strokeOpacity={0.6}
        />
      )}

      {/* Commit rail: outgoing line (dot to bottom) */}
      {activeBelow.has(row.rail) && (
        <line
          x1={commitX}
          y1={cy}
          x2={commitX}
          y2={h}
          stroke={color(row.rail)}
          strokeWidth={2}
          strokeOpacity={0.6}
        />
      )}

      {/* Fork-out curves */}
      {row.edges
        .filter((e) => e.type === "fork-out")
        .map((edge) => (
          <path
            key={`f-${edge.fromRail}-${edge.toRail}`}
            d={`M${rx(edge.fromRail)},${cy} C${rx(edge.fromRail)},${h} ${rx(edge.toRail)},${cy} ${rx(edge.toRail)},${h}`}
            stroke={edge.color}
            strokeWidth={2}
            strokeOpacity={0.6}
            fill="none"
          />
        ))}

      {/* Merge curves */}
      {row.edges
        .filter((e) => e.type === "merge-in")
        .map((edge) => {
          const isOutgoing = edge.fromRail === row.rail;
          const x1 = rx(edge.fromRail);
          const x2 = rx(edge.toRail);
          const d = isOutgoing
            ? `M${x1},${cy} C${x1},${h} ${x2},${cy} ${x2},${h}`
            : `M${x1},${0} C${x1},${cy} ${x2},${0} ${x2},${cy}`;
          return (
            <path
              key={`m-${edge.fromRail}-${edge.toRail}-${isOutgoing ? "out" : "in"}`}
              d={d}
              stroke={edge.color}
              strokeWidth={2}
              strokeOpacity={0.6}
              fill="none"
            />
          );
        })}

      {/* Rails that terminate here */}
      {Array.from(activeAbove).map((r) => {
        if (r === row.rail) return null;
        if (activeBelow.has(r)) return null;
        const x = rx(r);
        return (
          <line
            key={`end-${r}`}
            x1={x}
            y1={0}
            x2={x}
            y2={cy}
            stroke={color(r)}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        );
      })}

      {/* Commit dot */}
      <circle
        cx={commitX}
        cy={cy}
        r={5}
        fill={color(row.rail)}
        stroke="var(--color-background)"
        strokeWidth={2}
      />
    </svg>
  );
}

function AuthorAvatar({
  author,
  className,
  fallbackClassName,
}: {
  author: CommitAuthor;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("size-4", className)}>
      {author.avatarUrl ? <AvatarImage src={author.avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn("text-[8px] font-bold", fallbackClassName)}>
        {initials(author.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function formatDate(
  date: string | Date,
  t: UiMessages["commitGraph"],
  locale: string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return t.justNow;
  if (diffMins < 60) return t.minutesAgo(diffMins);
  if (diffHours < 24) return t.hoursAgo(diffHours);
  if (diffDays < 7) return t.daysAgo(diffDays);

  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(date: string | Date, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CommitDetail({
  commit,
  hashLength,
  railColor,
  children,
  className,
  style,
}: {
  commit: Commit;
  hashLength: number;
  railColor: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useLabels("commitGraph");
  const dateLocale = useDateLocale();
  const locale = dateLocale.code ?? "en-US";

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        data-slot="commit-entry"
        className={className}
        style={style}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="right" sideOffset={8} className="w-80 p-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-snug font-medium">{commit.message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <AuthorAvatar
                author={commit.author}
                className="size-3.5"
                fallbackClassName="text-[7px]"
              />
              {commit.author.name}
            </span>
            <span className="text-border">·</span>
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              {commit.hash.slice(0, hashLength)}
            </code>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatFullDate(commit.date, locale)}
          </div>
          {(commit.refs || commit.tag) && (
            <div className="flex flex-wrap gap-1">
              {commit.refs?.map((ref) => (
                <span
                  key={ref}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {ref}
                </span>
              ))}
              {commit.tag && (
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${railColor}20`,
                    color: railColor,
                  }}
                >
                  {commit.tag}
                </span>
              )}
            </div>
          )}
          {commit.parents.length > 0 && (
            <div className="text-[10px] text-muted-foreground/60">
              {commit.parents.length === 1 ? t.parent : t.parents}:{" "}
              {commit.parents.map((p) => p.slice(0, hashLength)).join(", ")}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Topological git commit graph (forks / merges).
 * @when App history, release notes, git timeline views
 * @example
 * <CommitGraph commits={[{ hash, message, author, date, parents }]} />
 * @family Chart & data
 */
export function CommitGraph({
  commits,
  truncateHash = 7,
  railWidth = 24,
  className,
  ...props
}: CommitGraphProps) {
  const t = useLabels("commitGraph");
  const dateLocale = useDateLocale();
  const locale = dateLocale.code ?? "en-US";

  // Simple mode: if no commit has parents, infer a linear topology
  const hasTopology = commits.some((c) => c.parents && c.parents.length > 0);
  const resolvedCommits = hasTopology
    ? commits
    : commits.map((c, i) => {
        const next = commits[i + 1];
        return {
          ...c,
          parents: next ? [next.hash] : [],
        };
      });

  if (resolvedCommits.length === 0) {
    return (
      <div
        data-slot="commit-graph"
        data-testid="commit-graph"
        className={cn(
          "flex items-center justify-center rounded-xl border border-border/60 bg-card py-10 text-sm text-muted-foreground shadow-sm",
          className,
        )}
        {...props}
      >
        {t.empty}
      </div>
    );
  }

  const rows = computeLayout(resolvedCommits);
  const maxRails = Math.max(
    ...rows.map((r) =>
      Math.max(
        r.rail + 1,
        r.rails.length,
        ...r.edges.map((e) => Math.max(e.fromRail, e.toRail) + 1),
      ),
    ),
  );
  const svgWidth = maxRails * railWidth;

  return (
    <div
      data-slot="commit-graph"
      data-testid="commit-graph"
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        {rows.map((row, i) => {
          const prevRow = i > 0 ? (rows[i - 1] ?? null) : null;
          return (
            <CommitDetail
              key={row.commit.hash}
              commit={row.commit}
              hashLength={truncateHash}
              railColor={color(row.rail)}
              className="flex w-full items-center gap-0 border-b border-border/30 transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Rails */}
              <div style={{ width: svgWidth }} className="shrink-0">
                <RailsSVG
                  row={row}
                  prevRow={prevRow}
                  railWidth={railWidth}
                  maxRails={maxRails}
                />
              </div>

              {/* Refs */}
              <div className="flex shrink-0 items-center gap-1 px-2">
                {row.commit.refs?.map((ref) => (
                  <span
                    key={ref}
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-none font-semibold"
                    style={{
                      borderColor: `${color(row.rail)}40`,
                      backgroundColor: `${color(row.rail)}10`,
                      color: color(row.rail),
                    }}
                  >
                    {ref}
                  </span>
                ))}
                {row.commit.tag && (
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] leading-none font-semibold"
                    style={{
                      backgroundColor: `${color(row.rail)}20`,
                      color: color(row.rail),
                    }}
                  >
                    {row.commit.tag}
                  </span>
                )}
              </div>

              {/* Message */}
              <p className="min-w-0 flex-1 truncate px-2 text-left text-sm text-foreground/80">
                {row.commit.message}
              </p>

              {/* Meta */}
              <div className="flex shrink-0 items-center gap-3 px-3">
                <code className="font-mono text-[11px] text-muted-foreground/60">
                  {row.commit.hash.slice(0, truncateHash)}
                </code>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AuthorAvatar author={row.commit.author} />
                  <span className="hidden sm:inline">
                    {row.commit.author.name}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  {formatDate(row.commit.date, t, locale)}
                </span>
              </div>
            </CommitDetail>
          );
        })}
      </div>
    </div>
  );
}
