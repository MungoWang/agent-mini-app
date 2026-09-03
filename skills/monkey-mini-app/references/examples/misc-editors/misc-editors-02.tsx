/**
 * @group editors
 * @title JiraWiki
 * @scenario JiraWiki markup rendered live next to the raw Textarea source (wiki tables, code blocks, colours).
 * @hint Left markup, right live preview
 */
import * as React from "react";

import { JiraWiki, Textarea } from "@monkey-mini-app/ui";

import { JIRA_WIKI_SAMPLE } from "../shared/jira-wiki-sample";

export default function MiscEditors02Example() {
  const [wiki, setWiki] = React.useState(JIRA_WIKI_SAMPLE);

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
