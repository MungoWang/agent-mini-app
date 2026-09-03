/**
 * @exampleOf Toggle
 * @title Toggle
 * @scenario Single pressed/unpressed icon button (bold, mute) — one binary view option, not a form value; use Switch for settings on/off.
 */
import * as React from "react";

import { Toggle } from "@monkey-mini-app/ui";

export default function Toggle01Example() {
  const [pressed, setPressed] = React.useState(false);

  return (
    <>
      <Toggle pressed={pressed} onPressedChange={setPressed}>
        Bold
      </Toggle>
    </>
  );
}
