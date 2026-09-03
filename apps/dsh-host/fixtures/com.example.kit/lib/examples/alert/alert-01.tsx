/**
 * @exampleOf Alert
 * @title Alert
 * @scenario Inline, non-blocking notice inside a page or panel — title + description, colours follow the semantic theme. Use for 'saved', '2 checks failed'; reach for Toast for transient confirmations and Dialog when the user must acknowledge.
 */
import { Alert, AlertDescription, AlertTitle } from "@monkey-mini-app/ui";

export default function Alert01Example() {
  return (
    <>
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something needs attention.</AlertDescription>
      </Alert>
    </>
  );
}
