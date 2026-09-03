/**
 * @exampleOf Toggle
 * @title Toggle
 * @scenario Single pressed/unpressed icon button (bold, mute) — one binary view option, not a form value; use Switch for settings on/off.
 */
import * as React from "react";

import { Toggle } from "@monkey-mini-app/ui";

const [open, setOpen] = React.useState(false);

const [pressed, setPressed] = React.useState(false);

const [align, setAlign] = React.useState("left");

const [page, setPage] = React.useState(1);

export default function Toggle01Example() {
  return (
    <>
<Toggle pressed={pressed} onPressedChange={setPressed}>
            Bold
          </Toggle>
    </>
  );
}
