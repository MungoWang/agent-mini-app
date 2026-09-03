/**
 * @exampleOf ToggleGroup
 * @title ToggleGroup
 * @scenario Mutually exclusive set of Toggle buttons for a view choice (alignment, density) held as one value.
 */
import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@monkey-mini-app/ui";

const [open, setOpen] = React.useState(false);

const [pressed, setPressed] = React.useState(false);

const [align, setAlign] = React.useState("left");

const [page, setPage] = React.useState(1);

export default function ToggleGroup01Example() {
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
