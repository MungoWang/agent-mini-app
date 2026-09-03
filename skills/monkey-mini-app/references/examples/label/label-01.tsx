/**
 * @exampleOf Label
 * @title Label
 * @scenario Accessible field label wired by htmlFor; the piece that makes a bare Input keyboard/AT-usable.
 */
import { Label } from "@monkey-mini-app/ui";

export default function Label01Example() {
  return (
    <Label htmlFor="demo-name">Name</Label>
  );
}
