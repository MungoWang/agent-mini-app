"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  Check,
  Copy,
  Download,
  Pause,
  Play,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";

import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { writeClipboard } from "@monkey-mini-app/ui/lib/clipboard";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type LogLevel = "info" | "warn" | "error" | "debug" | "verbose";

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp?: string;
};

type LevelColors = {
  text: string;
};

const DEFAULT_LEVEL_COLORS: Record<LogLevel, LevelColors> = {
  error: { text: "text-rose-500 dark:text-rose-400" },
  warn: { text: "text-amber-500 dark:text-amber-400" },
  info: { text: "text-sky-500 dark:text-sky-400" },
  debug: { text: "text-violet-500 dark:text-violet-400" },
  verbose: { text: "text-zinc-400 dark:text-zinc-500" },
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: "ERR",
  warn: "WRN",
  info: "INF",
  debug: "DBG",
  verbose: "VRB",
};

function formatTimestampFull(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}.${ms}`;
}

function useCopy() {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async (value: string) => {
    if (!(await writeClipboard(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, []);

  return { copied, copy };
}

function exportLogs(entries: LogEntry[]): void {
  const text = entries
    .map(
      (e) =>
        `[${formatTimestampFull(e.timestamp)}] [${LEVEL_LABELS[e.level]}] ${e.message}`,
    )
    .join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match = re.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <mark
        key={`h-${match.index}-${match[0]}`}
        className="rounded-sm bg-amber-300/40 px-0.5 text-inherit dark:bg-amber-400/30"
      >
        {match[0]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
    match = re.exec(text);
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function ToolbarButton({
  onClick,
  label,
  active,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none",
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active && "bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Virtualized streaming log viewer with level colors, search, and auto-scroll.
 * @when Streaming / CLI-style log output
 * @example
 * <LogViewer entries={[{ level: "info", message: "boot" }, { level: "error", message: "boom" }]} />
 * @family Realtime
 */
export function LogViewer({
  entries,
  title,
  maxHeight = 320,
  lineNumbers = true,
  timestamps = true,
  autoScroll = true,
  onClear,
  className,
}: {
  entries: LogEntry[];
  title?: string;
  maxHeight?: number;
  lineNumbers?: boolean;
  timestamps?: boolean;
  autoScroll?: boolean;
  onClear?: () => void;
  className?: string;
}) {
  const t = useLabels("logViewer");
  const resolvedTitle = title ?? t.title;
  const [paused, setPaused] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopy();

  const filteredEntries = React.useMemo(
    () =>
      searchQuery
        ? entries.filter((e) =>
            e.message.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : entries,
    [entries, searchQuery],
  );

  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });

  const scrollEnabled = autoScroll && !paused;

  React.useEffect(() => {
    if (!scrollEnabled || !isAtBottom || filteredEntries.length === 0) return;
    virtualizer.scrollToIndex(filteredEntries.length - 1, { align: "end" });
  }, [filteredEntries.length, scrollEnabled, isAtBottom, virtualizer]);

  const handleScroll = React.useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    if (filteredEntries.length === 0) return;
    virtualizer.scrollToIndex(filteredEntries.length - 1, { align: "end" });
    setIsAtBottom(true);
  }, [filteredEntries.length, virtualizer]);

  const lineNumberWidth = Math.max(String(filteredEntries.length).length, 3);

  function handleCopyAll() {
    const text = entries
      .map(
        (e) =>
          `[${formatTimestampFull(e.timestamp)}] [${LEVEL_LABELS[e.level]}] ${e.message}`,
      )
      .join("\n");
    void copy(text);
  }

  return (
    <div
      data-testid="log-viewer"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2">
        <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {resolvedTitle}
        </span>

        <span className="mr-1 text-[10px] tabular-nums text-muted-foreground">
          {searchQuery
            ? t.linesFiltered(filteredEntries.length, entries.length)
            : t.lines(filteredEntries.length)}
        </span>

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setSearchQuery("");
            }}
            label={searchOpen ? t.closeSearch : t.search}
            active={searchOpen}
          >
            <Search className="size-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setPaused(!paused)}
            label={paused ? t.resumeScroll : t.pauseScroll}
            active={paused}
          >
            {paused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
          </ToolbarButton>

          <ToolbarButton
            onClick={handleCopyAll}
            label={copied ? t.copied : t.copyAll}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </ToolbarButton>

          <ToolbarButton onClick={() => exportLogs(entries)} label={t.download}>
            <Download className="size-3.5" />
          </ToolbarButton>

          {onClear ? (
            <ToolbarButton onClick={onClear} label={t.clear}>
              <Trash2 className="size-3.5" />
            </ToolbarButton>
          ) : null}
        </div>
      </div>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-3 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.filterPlaceholder}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label={t.clearSearch}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="overflow-auto bg-card font-mono text-xs leading-relaxed [scrollbar-width:thin]"
        style={{ maxHeight }}
        role="log"
        aria-live="polite"
        aria-label={resolvedTitle}
      >
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            {searchQuery ? t.emptySearch : t.empty}
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const entry = filteredEntries[item.index];
              if (!entry) return null;
              const colors = DEFAULT_LEVEL_COLORS[entry.level];
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 flex w-full gap-3 border-b border-border/20 px-3 py-1 transition-colors hover:bg-muted/30"
                  style={{
                    top: item.start,
                    height: item.size,
                  }}
                >
                  {lineNumbers ? (
                    <span
                      className="shrink-0 select-none text-right text-muted-foreground/50"
                      style={{ width: `${lineNumberWidth}ch` }}
                      aria-hidden="true"
                    >
                      {item.index + 1}
                    </span>
                  ) : null}
                  {timestamps ? (
                    <span className="shrink-0 text-muted-foreground/60">
                      {formatTimestampFull(entry.timestamp)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "w-[3ch] shrink-0 text-right font-semibold",
                      colors.text,
                    )}
                  >
                    {LEVEL_LABELS[entry.level]}
                  </span>
                  <span className="min-w-0 flex-1 truncate whitespace-pre text-foreground/90">
                    {highlightSearch(entry.message, searchQuery)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isAtBottom ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border/40 bg-muted/30 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label={t.scrollLatest}
        >
          <ArrowDown className="size-3" />
          {t.newBelow}
        </button>
      ) : null}
    </div>
  );
}
