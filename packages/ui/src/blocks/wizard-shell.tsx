"use client";

import type { ReactNode } from "react";

import { Button } from "@monkey-mini-app/ui/components/button";
import { Stepper, StepperItem } from "@monkey-mini-app/ui/products/stepper";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type WizardStep = {
  id: string;
  label: string;
  /** Pass `false` while the step's form is incomplete — Next disables itself. Omit to allow. */
  valid?: boolean;
};

export type WizardShellProps = {
  /** The steps, in order. The rail is generated from this, so it cannot disagree with the body. */
  steps: WizardStep[];
  /** Which step is showing. The app owns it — the preset never navigates on its own. */
  index: number;
  /** Current step's content. The only scrolling area. */
  body: ReactNode;
  /** Replaces the generated Back/Next/Finish row (a preview pane, a second action…). */
  footer?: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  /** Fires on the last step's primary action. Without it the last step still shows Next. */
  onSubmit?: () => void;
  /** Greys the primary action and swaps in the busy label. */
  submitting?: boolean;
  className?: string;
};

/**
 * Multi-step flow: step rail on top, scrolling body, action row that never moves.
 *
 * Hand-rolled, a wizard's footer rides along inside the scrolling column, so every step change
 * jumps the buttons to a different height and the user chases them with the cursor; and Next is
 * enabled into an invalid step because the validity check lives in the form and the button lives
 * outside it. Here the footer is a `shrink-0` sibling of the scroller, and Next/Finish are
 * disabled straight from `steps[index].valid`, which is the only place that can know.
 *
 * @when Page shape: create / import / onboarding, one step at a time with validation per step
 * @example
 * <WizardShell
 *   steps={[{ id: "pick", label: "Choose file", valid: Boolean(file) }, { id: "map", label: "Map columns", valid: mapped }]}
 *   index={step}
 *   body={<StepBody />}
 *   onBack={() => setStep((s) => s - 1)}
 *   onNext={() => setStep((s) => s + 1)}
 *   onSubmit={() => void run()}
 * />
 * @family Layout & structure
 */
export function WizardShell({
  steps,
  index,
  body,
  footer,
  onBack,
  onNext,
  onSubmit,
  submitting = false,
  className,
}: WizardShellProps) {
  const t = useLabels("wizardShell");
  const current = steps[index];
  const last = index >= steps.length - 1;
  const canAdvance = current?.valid !== false;
  const primary = last && onSubmit ? t.finish : t.next;

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      data-testid="wizard-shell"
    >
      <div
        className="border-border shrink-0 border-b px-4 py-3"
        data-testid="wizard-rail"
      >
        <Stepper orientation="horizontal">
          {steps.map((s, i) => (
            <StepperItem
              key={s.id}
              step={i + 1}
              title={s.label}
              status={
                i < index ? "completed" : i === index ? "active" : "default"
              }
            />
          ))}
        </Stepper>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        data-testid="wizard-body"
      >
        {body}
      </div>

      <div
        className="border-border bg-background flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3"
        data-testid="wizard-footer"
      >
        {footer ?? (
          <>
            <Button
              variant="ghost"
              onClick={onBack}
              disabled={index === 0 || submitting}
              data-testid="wizard-back"
            >
              {t.back}
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t.stepOf(index + 1, steps.length)}
            </span>
            <Button
              onClick={last && onSubmit ? onSubmit : onNext}
              disabled={!canAdvance || submitting}
              data-testid="wizard-next"
            >
              {submitting ? t.working : primary}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
