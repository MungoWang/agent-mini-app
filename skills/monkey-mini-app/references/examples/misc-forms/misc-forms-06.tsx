/**
 * @group forms
 * @title TagInput / UserPicker / Rating / ColorPicker
 * @scenario Compact pickers that all store their own value shape: TagInput (string[]), UserPicker (user object), Rating (0–5), ColorPicker (hex).
 */
import * as React from "react";

import { ColorPicker, Rating, TagInput, UserPicker } from "@monkey-mini-app/ui";

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

export default function MiscForms06Example() {
  return (
    <>
        <div className="flex max-w-sm flex-col gap-3">
          <TagInput value={tags} onChange={setTags} />
          <UserPicker
            value={user}
            onChange={setUser}
            users={[
              { id: "ada", name: "Ada" },
              { id: "lin", name: "Lin" },
            ]}
          />
          <Rating value={stars} onChange={setStars} />
          <ColorPicker value={color} onChange={setColor} />
        </div>
    </>
  );
}
