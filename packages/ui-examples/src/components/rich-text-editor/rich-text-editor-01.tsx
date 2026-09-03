/**
 * @exampleOf RichTextEditor
 * @title RichTextEditor
 * @scenario WYSIWYG editing with a local contentEditable toolbar (bold/list/quote) — no CDN, no dependency; use when users are not writing raw markdown.
 * @hint Tiptap — toolbar is live
 */
import * as React from "react";

import { RichTextEditor } from "@monkey-mini-app/ui";

export default function RichTextEditor01Example() {
  const [html, setHtml] = React.useState("<p>Write a <strong>run note</strong>.</p>");

  return <RichTextEditor value={html} onChange={setHtml} />;
}
