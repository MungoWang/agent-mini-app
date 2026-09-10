import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormSheet } from "./form-sheet";

const panel = () =>
  document.querySelector('[data-slot="sheet-content"]') as HTMLElement;

/** base-ui marks its own close control; that beats matching an translated aria-label. */
const closeButton = () =>
  document.querySelector('[data-slot="sheet-close"]') as HTMLButtonElement;

function open(over: Partial<React.ComponentProps<typeof FormSheet>> = {}) {
  return render(
    <FormSheet
      open
      onOpenChange={vi.fn()}
      title="Edit issue"
      description="OPS-1042"
      footer={<button type="submit">Save</button>}
      {...over}
    >
      <input name="summary" defaultValue="x" />
    </FormSheet>,
  );
}

describe("FormSheet", () => {
  it("scrolls the body only — header and footer are siblings, not content", () => {
    open();
    const body = screen.getByTestId("form-sheet-body");
    expect(body).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");

    const header = panel().querySelector(
      '[data-slot="sheet-header"]',
    ) as HTMLElement;
    expect(header.className).toContain("shrink-0");
    expect(header.className).not.toContain("overflow-y-auto");

    // The footer must be visible without hunting, so it is outside the scroller…
    const footer = screen.getByTestId("form-sheet-footer");
    expect(footer).toHaveClass("shrink-0");
    expect(body.contains(footer)).toBe(false);
    // …but still inside the form, so its submit button belongs to the fields above it.
    const form = screen.getByTestId("form-sheet-form");
    expect(form.contains(footer)).toBe(true);
    expect(form.contains(body)).toBe(true);
  });

  it("gives Enter and the button one submit path", () => {
    const onSubmit = vi.fn();
    open({ onSubmit });

    fireEvent.submit(screen.getByTestId("form-sheet-form"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // preventDefault, or the sheet's host page reloads behind it.
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);
  });

  it("asks before throwing away a dirty sheet", () => {
    const onOpenChange = vi.fn();
    open({ dirty: true, onOpenChange });

    // Escape, the overlay and the X all arrive as onOpenChange(false) at the preset boundary.
    fireEvent.click(closeButton());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("form-sheet-guard")).toBeTruthy();

    // "Keep editing" dismisses the prompt and leaves the sheet standing…
    fireEvent.click(screen.getByText("Keep editing"));
    expect(onOpenChange).not.toHaveBeenCalled();

    // …and closing again re-arms it, because the edits are still unsaved.
    fireEvent.click(closeButton());
    expect(screen.getByTestId("form-sheet-guard")).toBeTruthy();
    fireEvent.click(screen.getByText("Discard"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not nag when nothing changed", () => {
    const onOpenChange = vi.fn();
    open({ dirty: false, onOpenChange });
    fireEvent.click(closeButton());
    expect(screen.queryByTestId("form-sheet-guard")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
