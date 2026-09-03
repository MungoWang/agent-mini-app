/**
 * @group forms
 * @title Checkbox / Switch / Radio
 * @scenario Three boolean-ish choices compared: Checkbox (agree), Switch (instant-effect setting), RadioGroup (one of N). Pick by semantics, not looks.
 */
import * as React from "react";

import { Checkbox, RadioGroup, RadioGroupItem, Switch } from "@monkey-mini-app/ui";

const [n, setN] = React.useState(3);

const [phone, setPhone] = React.useState("");

const [pwd, setPwd] = React.useState("secret");

const [search, setSearch] = React.useState("");

const [money, setMoney] = React.useState("12.50");

const [color, setColor] = React.useState("#2563eb");

const [stars, setStars] = React.useState(3);

const [tags, setTags] = React.useState(["qa", "ci"]);

const [user, setUser] = React.useState("ada");

const [auto, setAuto] = React.useState("");

const [cascade, setCascade] = React.useState<string[]>([]);

const [range, setRange] = React.useState([20, 80]);

const [slider, setSlider] = React.useState([40]);

const [on, setOn] = React.useState(true);

const [checked, setChecked] = React.useState(true);

const [radio, setRadio] = React.useState("a");

const [select, setSelect] = React.useState("stg");

const [native, setNative] = React.useState("dev");

const [text, setText] = React.useState("");

const [area, setArea] = React.useState("notes");

const [transfer, setTransfer] = React.useState(["b"]);

export default function MiscForms02Example() {
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
