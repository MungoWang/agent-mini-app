/**
 * @group forms
 * @title Input / Textarea
 * @scenario Free-text pair side by side: single-line Input vs multi-line Textarea, both controlled — the baseline before picking a specialised field.
 */
import * as React from "react";

import { Input, Textarea } from "@monkey-mini-app/ui";

export default function MiscForms01Example() {
  const [text, setText] = React.useState("");
  const [area, setArea] = React.useState("notes");

  return (
    <>
      <div className="flex max-w-sm flex-col gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here" />
        <Textarea value={area} onChange={(e) => setArea(e.target.value)} />
      </div>
    </>
  );
}
