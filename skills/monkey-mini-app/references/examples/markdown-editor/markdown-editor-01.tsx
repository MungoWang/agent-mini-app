/**
 * @exampleOf MarkdownEditor
 * @title MarkdownEditor
 * @scenario Write markdown with a live preview pane and a mode toggle (edit / split / preview) for docs and descriptions.
 * @hint Left CodeMirror, right live GFM preview
 */
import * as React from "react";

import { MarkdownEditor } from "@monkey-mini-app/ui";

export default function MarkdownEditor01Example() {
  const [md, setMd] = React.useState(
    "# Title\n\n**bold**, a [link](https://example.com), and a task:\n\n- [x] Review grid\n- [ ] Ship demo\n",
  );
  const [mdMode, setMdMode] = React.useState<"edit" | "split" | "preview">("split");

  return <MarkdownEditor value={md} onChange={setMd} mode={mdMode} onModeChange={setMdMode} />;
}
