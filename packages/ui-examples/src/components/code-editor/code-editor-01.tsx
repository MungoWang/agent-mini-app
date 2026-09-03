/**
 * @exampleOf CodeEditor
 * @title CodeEditor
 * @scenario Editable source with syntax highlighting and line numbers (CodeMirror 6 via CDN). Reach for it when the user changes config/scripts in-app; degrade to Textarea if the network blocks the CDN.
 * @hint CodeMirror 6
 */
import * as React from "react";

import { CodeEditor } from "@monkey-mini-app/ui";

export default function CodeEditor01Example() {
  const [code, setCode] = React.useState("export const n = 1\n");

  return <CodeEditor value={code} onChange={setCode} language="ts" />;
}
