import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WizardShell } from "./wizard-shell";

const STEPS = [
  { id: "a", label: "Choose", valid: true },
  { id: "b", label: "Map", valid: false },
  { id: "c", label: "Run", valid: true },
];

describe("WizardShell", () => {
  it("pins the action row outside the scrolling body", () => {
    render(
      <div style={{ height: 400 }}>
        <WizardShell steps={STEPS} index={0} body={<p>step one</p>} />
      </div>,
    );

    const root = screen.getByTestId("wizard-shell");
    expect(root).toHaveClass("h-full", "min-h-0");
    expect(root).not.toHaveClass("overflow-y-auto");

    const body = screen.getByTestId("wizard-body");
    expect(body).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");

    // The jump this preset kills: a footer inside the scroller lands somewhere new every step.
    const footer = screen.getByTestId("wizard-footer");
    expect(footer).toHaveClass("shrink-0");
    expect(body.contains(footer)).toBe(false);
    expect(screen.getByTestId("wizard-rail")).toHaveClass("shrink-0");
  });

  it("disables the primary action from the step's own validity", () => {
    const invalid = render(
      <WizardShell steps={STEPS} index={1} body={<p>map</p>} />,
    );
    expect(invalid.getByTestId("wizard-next")).toBeDisabled();
    invalid.unmount();

    const valid = render(
      <WizardShell steps={STEPS} index={0} body={<p>pick</p>} />,
    );
    expect(valid.getByTestId("wizard-next")).toBeEnabled();
    valid.unmount();
  });

  it("turns the primary action into finish on the last step", () => {
    const onNext = vi.fn();
    const onSubmit = vi.fn();
    render(
      <WizardShell
        steps={STEPS}
        index={2}
        body={<p>run</p>}
        onNext={onNext}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByTestId("wizard-next").textContent).toBe("Finish");
  });

  it("locks Back at the first step and everything while submitting", () => {
    const first = render(
      <WizardShell steps={STEPS} index={0} body={<p>one</p>} />,
    );
    expect(first.getByTestId("wizard-back")).toBeDisabled();
    first.unmount();

    const busy = render(
      <WizardShell steps={STEPS} index={0} body={<p>one</p>} submitting />,
    );
    expect(busy.getByTestId("wizard-next")).toBeDisabled();
    expect(busy.getByTestId("wizard-back")).toBeDisabled();
    expect(busy.getByTestId("wizard-next").textContent).toBe("Working…");
    busy.unmount();
  });

  it("shows the step count it derived from the array, not a hand-typed label", () => {
    render(<WizardShell steps={STEPS} index={1} body={<p>map</p>} />);
    expect(screen.getByTestId("wizard-footer").textContent).toContain(
      "Step 2 of 3",
    );
  });
});
