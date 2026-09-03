/**
 * @group editors
 * @title JiraWiki
 * @scenario JiraWiki markup rendered live next to the raw Textarea source (wiki tables, code blocks, colours).
 * @hint Left markup, right live preview
 */
import * as React from "react";

import { JiraWiki, Textarea } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../shared/jira-wiki-sample";

const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

const [code, setCode] = React.useState("export const n = 1\n");

const [md, setMd] = React.useState(
  "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n",
);

const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

const [jql, setJql] = React.useState('project = TMS AND status = "In Progress" ORDER BY updated DESC');

const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

export default function MiscEditors02Example() {
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid min-h-[280px] md:grid-cols-2">
          <Textarea
            value={wiki}
            onChange={(event) => setWiki(event.target.value)}
            spellCheck={false}
            className="min-h-[280px] resize-none rounded-none border-0 border-b font-mono md:border-r md:border-b-0"
          />
          <div className="overflow-auto p-3">
            <JiraWiki>{wiki}</JiraWiki>
          </div>
        </div>
      </div>
    </>
  );
}
