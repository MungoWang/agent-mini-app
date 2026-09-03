/**
 * @group forms
 * @title Checkbox / Switch / Radio
 * @scenario Three boolean-ish choices compared: Checkbox (agree), Switch (instant-effect setting), RadioGroup (one of N). Pick by semantics, not looks.
 */
import * as React from "react";

import { Checkbox, RadioGroup, RadioGroupItem, Switch } from "@monkey-mini-app/ui";

export default function MiscForms02Example() {
  const [on, setOn] = React.useState(true);
  const [checked, setChecked] = React.useState(true);
  const [radio, setRadio] = React.useState("a");

  return (
    <>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
          Accept
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={on} onCheckedChange={setOn} />
          Enabled {on ? "on" : "off"}
        </label>
        <RadioGroup value={radio} onValueChange={setRadio}>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="a" /> A
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="b" /> B
          </label>
        </RadioGroup>
      </div>
    </>
  );
}
