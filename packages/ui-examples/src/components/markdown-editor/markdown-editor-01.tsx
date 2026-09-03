/**
 * @exampleOf MarkdownEditor
 * @title MarkdownEditor
 * @scenario Write markdown with a live preview pane and a mode toggle (edit / split / preview) for docs and descriptions.
 * @hint Left CodeMirror, right live GFM preview
 */
import * as React from "react";

import { MarkdownEditor } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
    "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n"
  );

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

export default function MarkdownEditor01Example() {
  return (
    <MarkdownEditor value={md} onChange={setMd} mode={mdMode} onModeChange={setMdMode} />
  );
}
