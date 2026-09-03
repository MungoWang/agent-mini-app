/**
 * @exampleOf Button
 * @title Variants + icon sizing
 *
 * Portable: imports only react + bare @monkey-mini-app/ui. Copyable into a
 * mini-app `lib/` or into the skill. `@exampleOf` binds it to the Button contract.
 */
import { Button } from "@monkey-mini-app/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>default</Button>
      <Button variant="secondary">secondary</Button>
      <Button variant="outline">outline</Button>
      <Button variant="ghost">ghost</Button>
      <Button variant="destructive">destructive</Button>
      <Button variant="link">link</Button>
      <Button size="icon" aria-label="help">
        ?
      </Button>
    </div>
  );
}
