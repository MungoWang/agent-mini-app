/**
 * @group forms
 * @title Select / NativeSelect
 * @scenario Custom styled Select (compound parts, own trigger width) next to NativeSelect, which uses the OS picker — cheaper on mobile and keyboard.
 */
import * as React from "react";

import {
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monkey-mini-app/ui";

export default function MiscForms03Example() {
  const [select, setSelect] = React.useState("stg");
  const [native, setNative] = React.useState("dev");

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
