/**
 * @exampleOf DetailPanel
 * @title DetailPanel
 * @scenario Slide-over for record details that keeps the list visible and scroll position intact — the alternative to navigating away or a Dialog.
 */
import * as React from "react";

import { Button, DetailPanel } from "@monkey-mini-app/ui";

const [open, setOpen] = React.useState(false);

export default function DetailPanel01Example() {
  return (
    <>
        <Button onClick={() => setOpen(true)}>Open inspector</Button>
        <DetailPanel open={open} onOpenChange={setOpen} title="login-spec" description="Last run">
          Failed at step 2
        </DetailPanel>
    </>
  );
}
