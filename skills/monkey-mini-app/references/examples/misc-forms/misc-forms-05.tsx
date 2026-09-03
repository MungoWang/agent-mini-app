/**
 * @group forms
 * @title SearchInput / Autocomplete
 * @scenario Two ways to narrow a list: SearchInput (free text with clear) vs Autocomplete (suggest from a fixed option list).
 */
import * as React from "react";

import { Autocomplete, SearchInput } from "@monkey-mini-app/ui";

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

export default function MiscForms05Example() {
  return (
    <>
      <div className="flex max-w-sm flex-col gap-2">
        <SearchInput value={search} onChange={setSearch} />
        <Autocomplete
          value={auto}
          onChange={setAuto}
          options={["alpha", "bravo", "charlie", "delta"]}
          placeholder="Type a…"
        />
      </div>
    </>
  );
}
