import * as React from "react";

export type OptionCardOption = {
  value: string;
  label: string;
  preview: React.ReactNode;
  hint?: string;
  disabled?: boolean;
};

export type OptionCardGridProps = {
  options: OptionCardOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
  "aria-label": string;
  className?: string;
  /** Trailing placeholder card (e.g. custom). */
  trailing?: { label: string; hint?: string; onClick?: () => void; disabled?: boolean };
};

export function OptionCardGrid({
  options,
  value,
  onChange,
  columns = 3,
  "aria-label": ariaLabel,
  className,
  trailing,
}: OptionCardGridProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const values = options.map((o) => o.value);

  const focusAt = (index: number) => {
    const el = refs.current[index];
    el?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = options.map((o, i) => ({ o, i })).filter((x) => !x.o.disabled);
    if (!enabled.length) return;
    const pos = enabled.findIndex((x) => x.i === index);
    if (pos < 0) return;
    let nextPos = pos;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextPos = (pos + 1) % enabled.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextPos = (pos - 1 + enabled.length) % enabled.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextPos = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextPos = enabled.length - 1;
    } else {
      return;
    }
    const next = enabled[nextPos];
    if (!next) return;
    focusAt(next.i);
    if (!next.o.disabled) onChange(next.o.value);
  };

  return (
    <div
      className={`mma-optgrid mma-optgrid--${columns}${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt, index) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={opt.hint ? `${opt.label}. ${opt.hint}` : opt.label}
            disabled={opt.disabled}
            tabIndex={checked || (!value && index === 0) ? 0 : -1}
            className="mma-optcard"
            data-on={checked ? "1" : "0"}
            ref={(el) => {
              refs.current[index] = el;
            }}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            <span className="mma-optcard-preview" aria-hidden="true">
              {opt.preview}
            </span>
            <span className="mma-optcard-label">{opt.label}</span>
            {checked ? <span className="mma-optcard-check" aria-hidden="true">✓</span> : null}
          </button>
        );
      })}
      {trailing ? (
        <button
          type="button"
          className="mma-optcard mma-optcard--ghost"
          disabled={trailing.disabled !== false}
          title={trailing.hint}
          onClick={() => trailing.onClick?.()}
        >
          <span className="mma-optcard-preview mma-optcard-preview--plus" aria-hidden="true">
            +
          </span>
          <span className="mma-optcard-label">{trailing.label}</span>
        </button>
      ) : null}
      {/* keep values referenced for a11y tooling */}
      <span hidden>{values.join(",")}</span>
    </div>
  );
}
