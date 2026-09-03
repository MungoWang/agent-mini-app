/**
 * @group forms
 * @title Select / NativeSelect
 * @scenario Custom styled Select (compound parts, own trigger width) next to NativeSelect, which uses the OS picker — cheaper on mobile and keyboard.
 */
import * as React from "react";

import { NativeSelect, NativeSelectOption, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@monkey-mini-app/ui";

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

export default function MiscForms03Example() {
  return (
    <>
        <div className="flex flex-wrap gap-3">
          <Select value={select} onValueChange={(value) => value && setSelect(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dev">dev</SelectItem>
              <SelectItem value="stg">stg</SelectItem>
              <SelectItem value="prd">prd</SelectItem>
            </SelectContent>
          </Select>
          <NativeSelect value={native} onChange={(e) => setNative(e.target.value)}>
            <NativeSelectOption value="dev">dev</NativeSelectOption>
            <NativeSelectOption value="stg">stg</NativeSelectOption>
          </NativeSelect>
        </div>
    </>
  );
}
