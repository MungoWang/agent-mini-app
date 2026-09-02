import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper, StepperItem } from "./stepper";

describe("Stepper", () => {
  it("marks the active step", () => {
    render(
      <Stepper>
        <StepperItem title="One" status="completed" />
        <StepperItem title="Two" status="active">
          Active body
        </StepperItem>
        <StepperItem title="Three" status="default" />
      </Stepper>
    );
    const root = screen.getByTestId("stepper");
    expect(root).toHaveAttribute("data-orientation", "vertical");
    expect(root).toHaveTextContent("Two");
    expect(root).toHaveTextContent("Active body");
    expect(root.querySelector('[data-status="active"]')).toHaveTextContent("Two");
  });

  it("renders horizontal and shows only the active step children", () => {
    render(
      <Stepper orientation="horizontal">
        <StepperItem title="One" status="completed">
          Done body
        </StepperItem>
        <StepperItem title="Two" status="active" description="QA sign-off">
          Active body
        </StepperItem>
        <StepperItem title="Three" status="default">
          Todo body
        </StepperItem>
      </Stepper>
    );
    const root = screen.getByTestId("stepper");
    expect(root).toHaveAttribute("data-orientation", "horizontal");
    expect(root).toHaveTextContent("Two");
    expect(root).toHaveTextContent("Active body");
    expect(root).toHaveTextContent("QA sign-off");
    expect(root).not.toHaveTextContent("Done body");
    expect(root).not.toHaveTextContent("Todo body");
  });

  it("auto-numbers steps via cloneElement", () => {
    render(
      <Stepper>
        <StepperItem title="First" status="active" />
        <StepperItem title="Second" status="default" />
      </Stepper>
    );
    const root = screen.getByTestId("stepper");
    expect(root).toHaveTextContent("1");
    expect(root).toHaveTextContent("2");
  });
});
