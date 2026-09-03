/**
 * @exampleOf JsonViewer
 * @title JsonViewer
 * @scenario Collapsible tree over an API response payload; use for debugging output instead of <pre>{JSON.stringify(...)}.
 */
import { JsonViewer } from "@monkey-mini-app/ui";

export default function JsonViewer01Example() {
  return (
    <JsonViewer value={{ ok: true, count: 2, nested: { a: 1 } }} />
  );
}
