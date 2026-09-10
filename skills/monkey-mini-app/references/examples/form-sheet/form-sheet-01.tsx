/**
 * @exampleOf FormSheet
 * @title FormSheet
 * @scenario Edit a record over the list: title pinned, fields scrolling between the header and the action row, Enter and Save sharing one submit, and closing a dirty sheet asking first.
 * @hint Change a field, then hit Escape — the discard prompt appears; without a change it closes straight away
 */
import * as React from "react";

import { Button, FormSheet, Input, NativeSelect, StatusBadge } from "@monkey-mini-app/ui";

export default function FormSheet01Example() {
  const [open, setOpen] = React.useState(true);
  const [summary, setSummary] = React.useState("Nightly export drops the last sheet");
  const [status, setStatus] = React.useState("InProgress");
  const [dirty, setDirty] = React.useState(false);
  const [saved, setSaved] = React.useState(0);

  const edit = () => setDirty(true);

  return (
    <div className="text-muted-foreground flex h-[420px] items-center justify-center text-sm">
      <p>The sheet is open — scroll the fields, then press Escape.</p>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="Edit issue"
        description="OPS-1042 · opened 3 days ago"
        header={
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={status} />
            {saved > 0 ? <span className="text-xs">saved {saved}×</span> : null}
          </div>
        }
        dirty={dirty}
        onSubmit={() => {
          setDirty(false);
          setSaved((n) => n + 1);
          setOpen(false);
        }}
        footer={
          <>
            <Button type="submit" disabled={!dirty}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => i).map((i) => (
            <label key={i} className="flex flex-col items-start gap-1 text-sm">
              <span className="text-xs">{i === 0 ? "Summary" : `Field ${i + 1}`}</span>
              {i === 0 ? (
                <Input
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    edit();
                  }}
                />
              ) : i === 2 ? (
                <NativeSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    edit();
                  }}
                >
                  <option>To Do</option>
                  <option>InProgress</option>
                  <option>Done</option>
                </NativeSelect>
              ) : (
                <Input defaultValue={`value ${i + 1}`} onChange={edit} />
              )}
            </label>
          ))}
        </div>
      </FormSheet>
    </div>
  );
}
