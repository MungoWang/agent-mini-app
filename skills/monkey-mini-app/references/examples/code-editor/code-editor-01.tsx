/**
 * @exampleOf CodeEditor
 * @title CodeEditor
 * @scenario Editable source with syntax highlighting and line numbers (CodeMirror 6 via CDN). Reach for it when the user changes config/scripts in-app; degrade to Textarea if the network blocks the CDN.
 * @hint CodeMirror 6
 */
import * as React from "react";

import { CodeEditor } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
    "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n"
  );

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

export default function CodeEditor01Example() {
  return (
    <CodeEditor value={code} onChange={setCode} language="ts" />
  );
}
