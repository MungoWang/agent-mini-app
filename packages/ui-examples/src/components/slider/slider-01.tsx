/**
 * @exampleOf Slider
 * @title Slider / SliderRange
 * @scenario One-handle range for 'pick a value' (thresholds, limits); SliderRange beside it for min–max filter pairs.
 */
import * as React from "react";

import { Slider, SliderRange } from "@monkey-mini-app/ui";

export default function Slider01Example() {
  const [range, setRange] = React.useState([20, 80]);
  const [slider, setSlider] = React.useState([40]);

  return (
    <>
      <div className="flex max-w-sm flex-col gap-4">
        <Slider value={slider} onValueChange={(v) => setSlider(Array.from(v as number[]))} />
        <SliderRange value={range} onChange={setRange} />
      </div>
    </>
  );
}
