/**
 * @group forms
 * @title Cascader / Transfer
 * @scenario Multi-value selection patterns: Cascader walks a nested option tree, Transfer moves whole items between available/selected lists.
 */
import * as React from "react";

import { Cascader, Transfer } from "@monkey-mini-app/ui";

export default function MiscForms07Example() {
  const [cascade, setCascade] = React.useState<string[]>([]);
  const [transfer, setTransfer] = React.useState(["b"]);

  return (
    <>
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
    </>
  );
}
