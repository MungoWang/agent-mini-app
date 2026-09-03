/**
 * @exampleOf Stepper
 * @title Stepper
 * @scenario Multi-step flow (draft → review → ship) with completed/active/pending states, vertical and horizontal.
 * @hint Vertical and horizontal
 */
import * as React from "react";

import { Stepper, StepperItem } from "@monkey-mini-app/ui";

export default function Stepper01Example() {
  const [step, setStep] = React.useState(1);

  return (
    <>
      <div className="flex flex-col gap-6">
        <Stepper>
          <StepperItem
            title="Draft"
            description="Write the change"
            status={step > 0 ? "completed" : "active"}
          />
          <StepperItem
            title="Review"
            description="QA sign-off"
            status={step > 1 ? "completed" : step === 1 ? "active" : "default"}
          />
          <StepperItem title="Done" description="Shipped" status={step >= 2 ? "active" : "default"} />
        </Stepper>
        <Stepper orientation="horizontal">
          <StepperItem title="Draft" status={step > 0 ? "completed" : "active"} />
          <StepperItem title="Review" status={step > 1 ? "completed" : step === 1 ? "active" : "default"} />
          <StepperItem title="Done" status={step >= 2 ? "active" : "default"} />
        </Stepper>
      </div>
      <button type="button" className="mt-2 text-sm underline" onClick={() => setStep((s) => (s + 1) % 3)}>
        Next step
      </button>
    </>
  );
}
