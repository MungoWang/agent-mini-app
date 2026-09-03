/**
 * @exampleOf JqlInput
 * @title JqlInput
 * @scenario Query-language field with syntax feedback (JQL/SQL-ish filters) — the CodeMirror-powered sibling of SearchInput.
 * @hint CodeMirror JQL · type to complete fields
 */
import * as React from "react";

import { JqlInput } from "@monkey-mini-app/ui";

export default function JqlInput01Example() {
  const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

  return (
    <>
      <JqlInput value={jql} onChange={setJql} />
      <p className="text-muted-foreground mt-2 font-mono text-xs">{jql}</p>
    </>
  );
}
