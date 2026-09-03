/**
 * @exampleOf Bubble
 * @title Bubble
 * @scenario One side of a chat transcript — agent vs user bubble without hand-rolling alignment or spacing.
 */
import { Bubble, BubbleContent } from "@monkey-mini-app/ui";

export default function Bubble01Example() {
  return (
    <>
<Bubble>
            <BubbleContent>Can you rerun login-spec?</BubbleContent>
          </Bubble>
    </>
  );
}
