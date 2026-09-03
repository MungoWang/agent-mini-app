/**
 * @exampleOf ConfirmDialog
 * @title ConfirmDialog / Toast
 * @scenario Destructive-action guard — one click opens a yes/no dialog, cancel keeps state; pair with toast for the result. Do not hand-roll a Dialog for confirmations.
 */
import * as React from "react";

import { Button, ConfirmDialog, toast } from "@monkey-mini-app/ui";

export default function ConfirmDialog01Example() {
  const [confirm, setConfirm] = React.useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          Delete
        </Button>
        <Button variant="outline" onClick={() => toast.add({ title: "Saved", description: "Run updated." })}>
          Toast
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this run?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => setConfirm(false)}
      />
    </>
  );
}
