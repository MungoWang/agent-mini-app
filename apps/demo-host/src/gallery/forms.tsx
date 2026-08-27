import * as React from "react"
import { Autocomplete } from "@monkey-mini-app/ui/composites/autocomplete"
import { Cascader } from "@monkey-mini-app/ui/composites/cascader"
import { ColorPicker } from "@monkey-mini-app/ui/composites/color-picker"
import { Copyable } from "@monkey-mini-app/ui/composites/copyable"
import { CurrencyInput } from "@monkey-mini-app/ui/composites/currency-input"
import { NumberField } from "@monkey-mini-app/ui/composites/number-field"
import { PasswordField } from "@monkey-mini-app/ui/composites/password-field"
import { PhoneInput } from "@monkey-mini-app/ui/composites/phone-input"
import { Rating } from "@monkey-mini-app/ui/composites/rating"
import { SearchInput } from "@monkey-mini-app/ui/composites/search-input"
import { SliderRange } from "@monkey-mini-app/ui/composites/slider-range"
import { TagInput } from "@monkey-mini-app/ui/composites/tag-input"
import { Transfer } from "@monkey-mini-app/ui/composites/transfer"
import { UserPicker } from "@monkey-mini-app/ui/composites/user-picker"
import { Checkbox } from "@monkey-mini-app/ui/components/checkbox"
import { Input } from "@monkey-mini-app/ui/components/input"
import { Label } from "@monkey-mini-app/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@monkey-mini-app/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monkey-mini-app/ui/components/select"
import { Slider } from "@monkey-mini-app/ui/components/slider"
import { Switch } from "@monkey-mini-app/ui/components/switch"
import { Textarea } from "@monkey-mini-app/ui/components/textarea"
import { NativeSelect, NativeSelectOption } from "@monkey-mini-app/ui/components/native-select"
import { Example } from "./section"

export function FormExamples() {
  const [n, setN] = React.useState(3)
  const [phone, setPhone] = React.useState("")
  const [pwd, setPwd] = React.useState("secret")
  const [search, setSearch] = React.useState("")
  const [money, setMoney] = React.useState("12.50")
  const [color, setColor] = React.useState("#2563eb")
  const [stars, setStars] = React.useState(3)
  const [tags, setTags] = React.useState(["qa", "ci"])
  const [user, setUser] = React.useState("ada")
  const [auto, setAuto] = React.useState("")
  const [cascade, setCascade] = React.useState<string[]>([])
  const [range, setRange] = React.useState([20, 80])
  const [slider, setSlider] = React.useState([40])
  const [on, setOn] = React.useState(true)
  const [checked, setChecked] = React.useState(true)
  const [radio, setRadio] = React.useState("a")
  const [select, setSelect] = React.useState("stg")
  const [native, setNative] = React.useState("dev")
  const [text, setText] = React.useState("")
  const [area, setArea] = React.useState("notes")
  const [transfer, setTransfer] = React.useState(["b"])

  return (
    <>
      <Example id="number-field" title="NumberField" hint="Plus/minus and typing">
        <NumberField value={n} onChange={setN} min={0} max={99} />
        <p className="text-muted-foreground mt-2 text-xs" data-testid="number-field-value">
          value: {n}
        </p>
      </Example>
      <Example id="input" title="Input / Textarea">
        <div className="flex max-w-sm flex-col gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here" />
          <Textarea value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
      </Example>
      <Example id="checkbox-switch-radio" title="Checkbox / Switch / Radio">
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
      </Example>
      <Example id="select" title="Select / NativeSelect">
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
      </Example>
      <Example id="slider" title="Slider / SliderRange">
        <div className="flex max-w-sm flex-col gap-4">
          <Slider value={slider} onValueChange={(v) => setSlider(Array.from(v as number[]))} />
          <SliderRange value={range} onChange={setRange} />
        </div>
      </Example>
      <Example id="phone-password" title="Phone / Password / Currency / Copyable">
        <div className="flex max-w-sm flex-col gap-2">
          <PhoneInput value={phone} onChange={setPhone} />
          <PasswordField value={pwd} onChange={setPwd} />
          <CurrencyInput value={money} onChange={setMoney} />
          <Copyable value="TMS-55357" />
        </div>
      </Example>
      <Example id="search-auto" title="SearchInput / Autocomplete">
        <div className="flex max-w-sm flex-col gap-2">
          <SearchInput value={search} onChange={setSearch} />
          <Autocomplete
            value={auto}
            onChange={setAuto}
            options={["alpha", "bravo", "charlie", "delta"]}
            placeholder="Type a…"
          />
        </div>
      </Example>
      <Example id="tags-user-rating-color" title="TagInput / UserPicker / Rating / ColorPicker">
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
      </Example>
      <Example id="cascader-transfer" title="Cascader / Transfer">
        <div className="flex flex-col gap-4">
          <Cascader
            value={cascade}
            onChange={setCascade}
            options={[
              {
                value: "cn",
                label: "China",
                children: [
                  { value: "sh", label: "Shanghai" },
                  { value: "bj", label: "Beijing" },
                ],
              },
              { value: "us", label: "US", children: [{ value: "sf", label: "SF" }] },
            ]}
          />
          <Transfer
            value={transfer}
            onChange={setTransfer}
            items={[
              { id: "a", label: "Alpha" },
              { id: "b", label: "Bravo" },
              { id: "c", label: "Charlie" },
            ]}
          />
        </div>
      </Example>
      <Example id="field-label" title="Label">
        <div className="flex flex-col gap-1">
          <Label htmlFor="demo-name">Name</Label>
          <Input id="demo-name" placeholder="Ada" />
        </div>
      </Example>
    </>
  )
}
