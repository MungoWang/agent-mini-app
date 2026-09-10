/**
 * @exampleOf SettingsSplit
 * @title SettingsSplit
 * @scenario A settings page in a fixed-height panel: the jump list tracks the section you are reading, each side scrolls on its own, and the unsaved bar stays pinned to the content pane.
 * @hint Scroll the sections — the nav highlight follows; edit a field and the save bar appears without the layout moving
 */
import * as React from "react";

import { Button, Input, NativeSelect, SettingsSplit } from "@monkey-mini-app/ui";

const GROUPS = [
  {
    id: "general",
    label: "General",
    description: "Name, timezone, first day of week",
    rows: ["Display name", "Timezone"],
  },
  {
    id: "notify",
    label: "Notifications",
    description: "Where events land",
    rows: ["Email", "Webhook URL"],
  },
  {
    id: "data",
    label: "Data",
    description: "Retention and exports",
    rows: ["Retention days", "Export format"],
  },
  {
    id: "danger",
    label: "Danger zone",
    description: "Irreversible, on purpose",
    rows: ["Workspace slug"],
  },
];

export default function SettingsSplit01Example() {
  const [dirty, setDirty] = React.useState(false);
  const edit = () => setDirty(true);

  return (
    <div className="h-[460px]">
      <SettingsSplit
        nav={<p className="text-sm font-medium">Workspace settings</p>}
        sections={GROUPS.map((g) => ({
          id: g.id,
          label: g.label,
          description: g.description,
          content: (
            <div className="flex flex-col gap-3">
              {g.rows.map((r) => (
                <label key={r} className="flex flex-col items-start gap-1 text-sm">
                  <span className="text-muted-foreground text-xs">{r}</span>
                  {r === "Export format" ? (
                    <NativeSelect onChange={edit}>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </NativeSelect>
                  ) : (
                    <Input defaultValue={r.toLowerCase().replace(/ /g, "-")} onChange={edit} />
                  )}
                </label>
              ))}
            </div>
          ),
        }))}
        footer={
          dirty ? (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">Unsaved changes</span>
              <Button size="sm" onClick={() => setDirty(false)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDirty(false)}>
                Discard
              </Button>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
