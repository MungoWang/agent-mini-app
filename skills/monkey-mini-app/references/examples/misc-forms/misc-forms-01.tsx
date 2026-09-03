/**
 * @group forms
 * @title Input / Textarea
 * @scenario Free-text pair side by side: single-line Input vs multi-line Textarea, both controlled — the baseline before picking a specialised field.
 */
import * as React from "react";

import { Input, Textarea } from "@monkey-mini-app/ui";

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

export default function MiscForms01Example() {
  return (
    <>
        <div className="flex max-w-sm flex-col gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here" />
          <Textarea value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
    </>
  );
}
