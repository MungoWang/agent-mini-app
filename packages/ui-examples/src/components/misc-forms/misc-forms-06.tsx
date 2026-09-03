/**
 * @group forms
 * @title TagInput / UserPicker / Rating / ColorPicker
 * @scenario Compact pickers that all store their own value shape: TagInput (string[]), UserPicker (user object), Rating (0–5), ColorPicker (hex).
 */
import * as React from "react";

import { ColorPicker, Rating, TagInput, UserPicker } from "@monkey-mini-app/ui";

export default function MiscForms06Example() {
  const [color, setColor] = React.useState("#2563eb");
  const [stars, setStars] = React.useState(3);
  const [tags, setTags] = React.useState(["qa", "ci"]);
  const [user, setUser] = React.useState("ada");

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
