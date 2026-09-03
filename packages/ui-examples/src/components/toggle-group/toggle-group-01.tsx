/**
 * @exampleOf ToggleGroup
 * @title ToggleGroup
 * @scenario Mutually exclusive set of Toggle buttons for a view choice (alignment, density) held as one value.
 */
import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@monkey-mini-app/ui";

export default function ToggleGroup01Example() {
  const [align, setAlign] = React.useState("left");

  return (
    <>
      <ToggleGroup value={[align]} onValueChange={(v) => v[0] && setAlign(v[0])}>
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center">Center</ToggleGroupItem>
        <ToggleGroupItem value="right">Right</ToggleGroupItem>
      </ToggleGroup>
    </>
  );
}
