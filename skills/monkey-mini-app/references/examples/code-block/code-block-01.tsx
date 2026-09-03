/**
 * @exampleOf CodeBlock
 * @title CodeBlock
 * @scenario Read-only highlighted source with filename, language badge and copy button (shiki via CDN); use when the code is shown, not edited.
 */
import { CodeBlock } from "@monkey-mini-app/ui";

export default function CodeBlock01Example() {
  return (
    <>
<CodeBlock
            language="ts"
            code={`type Run = { id: string }\nexport const run: Run = { id: \"1\" }\n`}
          />
    </>
  );
}
