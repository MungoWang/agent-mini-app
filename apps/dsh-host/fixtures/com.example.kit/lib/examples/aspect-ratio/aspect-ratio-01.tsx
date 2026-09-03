/**
 * @exampleOf AspectRatio
 * @title AspectRatio
 * @scenario A media/skeleton placeholder that must keep a fixed ratio (16/9 here) while its container resizes — prevents layout shift when images or embeds load late.
 */
import { AspectRatio } from "@monkey-mini-app/ui";

export default function AspectRatio01Example() {
  return (
    <>
      <div className="w-48">
        <AspectRatio ratio={16 / 9} className="rounded-lg bg-muted" />
      </div>
    </>
  );
}
