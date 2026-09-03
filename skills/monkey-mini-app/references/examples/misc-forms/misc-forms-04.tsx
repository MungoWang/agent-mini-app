/**
 * @group forms
 * @title Phone / Password / Currency / Copyable
 * @scenario Format-aware text fields that validate while typing: PhoneInput, PasswordField (mask toggle), CurrencyInput, plus Copyable for read-only tokens/ids.
 */
import * as React from "react";

import { Copyable, CurrencyInput, PasswordField, PhoneInput } from "@monkey-mini-app/ui";

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

export default function MiscForms04Example() {
  return (
    <>
      <div className="flex max-w-sm flex-col gap-2">
        <PhoneInput value={phone} onChange={setPhone} />
        <PasswordField value={pwd} onChange={setPwd} />
        <CurrencyInput value={money} onChange={setMoney} />
        <Copyable value="TMS-55357" />
      </div>
    </>
  );
}
