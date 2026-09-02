"use client";

import * as React from "react";
import { Check, ClipboardList, Copy, Eye, EyeOff } from "lucide-react";

import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { writeClipboard } from "@monkey-mini-app/ui/lib/clipboard";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type Environment =
  | "production"
  | "preview"
  | "development"
  | (string & {});

export type EnvVariable = {
  /** Variable name (e.g. DATABASE_URL). */
  key: string;
  /** Variable value. Masked by default. */
  value: string;
  /** Target environment. When provided, renders as a pill. */
  environment?: Environment;
  /** Optional description shown below the key. */
  description?: string;
};

export type EnvTableProps = Omit<
  React.ComponentProps<"div">,
  "children" | "title"
> & {
  /** Environment variables to display. */
  variables: EnvVariable[];
  /** Optional heading above the table. */
  title?: string;
  /** Start with all values revealed. Defaults to false. */
  defaultRevealed?: boolean;
};

function envBadgeColor(env: Environment): string {
  switch (env) {
    case "production":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "preview":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "development":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function maskValue(value: string): string {
  if (value.length <= 4) return "••••••••";
  return `${value.slice(0, 4)}••••••••`;
}

function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    void writeClipboard(value).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function RevealButton({
  revealed,
  onToggle,
  label,
}: {
  revealed: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {revealed ? (
        <EyeOff className="size-3.5" />
      ) : (
        <Eye className="size-3.5" />
      )}
    </button>
  );
}

function EnvRow({
  variable,
  revealed,
  onToggleReveal,
}: {
  variable: EnvVariable;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const t = useLabels("envTable");
  const displayValue = revealed ? variable.value : maskValue(variable.value);

  return (
    <div
      data-slot="env-row"
      className="group flex items-start gap-3 px-3 py-2.5 sm:items-center sm:px-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2 sm:w-[220px]">
          <span className="truncate font-mono text-xs font-semibold text-foreground">
            {variable.key}
          </span>
          {variable.environment ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                envBadgeColor(variable.environment),
              )}
            >
              {variable.environment}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "break-all font-mono text-xs",
              revealed ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {displayValue}
          </span>
          {variable.description ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              {variable.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <RevealButton
          revealed={revealed}
          onToggle={onToggleReveal}
          label={revealed ? t.hideKey(variable.key) : t.revealKey(variable.key)}
        />
        <CopyButton value={variable.value} label={t.copyValue(variable.key)} />
      </div>
    </div>
  );
}

/**
 * Read-only env var table with masked values and copy.
 * @when Settings / deploy preview / secrets display
 * @example
 * <EnvTable variables={[{ key: "API_URL", value: "https://…", environment: "production" }]} />
 * @family Data & tables
 */
export function EnvTable({
  variables,
  title,
  defaultRevealed = false,
  className,
  ...props
}: EnvTableProps) {
  const t = useLabels("envTable");
  const [revealedIndices, setRevealedIndices] = React.useState<Set<number>>(
    () => (defaultRevealed ? new Set(variables.map((_, i) => i)) : new Set()),
  );
  const [copiedAll, setCopiedAll] = React.useState(false);

  const allRevealed =
    variables.length > 0 && revealedIndices.size === variables.length;

  const toggleIndex = React.useCallback((index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    if (allRevealed) {
      setRevealedIndices(new Set());
    } else {
      setRevealedIndices(new Set(variables.map((_, i) => i)));
    }
  }, [allRevealed, variables]);

  const copyAllAsEnv = React.useCallback(() => {
    const text = variables.map((v) => `${v.key}=${v.value}`).join("\n");
    void writeClipboard(text).then((ok) => {
      if (!ok) return;
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    });
  }, [variables]);

  if (variables.length === 0) {
    return (
      <div
        data-testid="env-table"
        data-slot="env-table"
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

  return (
    <div
      data-testid="env-table"
      data-slot="env-table"
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {variables.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleAll}
            aria-label={allRevealed ? t.hideAllValues : t.revealAllValues}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allRevealed ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {allRevealed ? t.hideAll : t.revealAll}
            </span>
          </button>
          <button
            type="button"
            onClick={copyAllAsEnv}
            aria-label={t.copyEnv}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copiedAll ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <ClipboardList className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {copiedAll ? t.copied : t.copyEnv}
            </span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {variables.map((variable, i) => (
          <EnvRow
            key={`${variable.key}-${i}`}
            variable={variable}
            revealed={revealedIndices.has(i)}
            onToggleReveal={() => toggleIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
