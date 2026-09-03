/**
 * @exampleOf JqlInput
 * @title JqlInput
 * @scenario Query-language field with syntax feedback (JQL/SQL-ish filters) — the CodeMirror-powered sibling of SearchInput.
 * @hint CodeMirror JQL · type to complete fields
 */
import * as React from "react";

import { JqlInput } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
  "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n",
);

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

export default function JqlInput01Example() {
  return (
    <>
      <JqlInput value={jql} onChange={setJql} />
      <p className="text-muted-foreground mt-2 font-mono text-xs">{jql}</p>
    </>
  );
}
