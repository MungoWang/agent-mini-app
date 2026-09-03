/**
 * @group forms
 * @title SearchInput / Autocomplete
 * @scenario Two ways to narrow a list: SearchInput (free text with clear) vs Autocomplete (suggest from a fixed option list).
 */
import * as React from "react";

import { Autocomplete, SearchInput } from "@monkey-mini-app/ui";

export default function MiscForms05Example() {
  const [search, setSearch] = React.useState("");
  const [auto, setAuto] = React.useState("");

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
