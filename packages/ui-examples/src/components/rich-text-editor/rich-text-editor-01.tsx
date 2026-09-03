/**
 * @exampleOf RichTextEditor
 * @title RichTextEditor
 * @scenario WYSIWYG editing with a local contentEditable toolbar (bold/list/quote) — no CDN, no dependency; use when users are not writing raw markdown.
 * @hint Tiptap — toolbar is live
 */
import * as React from "react";

import { RichTextEditor } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
  "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n",
);

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

export default function RichTextEditor01Example() {
  return <RichTextEditor value={html} onChange={setHtml} />;
}
