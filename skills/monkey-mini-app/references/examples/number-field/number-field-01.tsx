/**
 * @exampleOf NumberField
 * @title NumberField
 * @scenario Numeric input with stepper buttons and clamped min/max, so quantity fields never receive NaN or out-of-range text.
 * @hint Plus/minus and typing
 */
import * as React from "react";

import { NumberField } from "@monkey-mini-app/ui";

export default function NumberField01Example() {
  const [n, setN] = React.useState(3);

  return (
    <>
      <NumberField value={n} onChange={setN} min={0} max={99} />
      <p className="text-muted-foreground mt-2 text-xs" data-testid="number-field-value">
        value: {n}
      </p>
    </>
  );
}
