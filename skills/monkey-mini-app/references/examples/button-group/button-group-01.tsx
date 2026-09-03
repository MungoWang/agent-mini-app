/**
 * @exampleOf ButtonGroup
 * @title Button / ButtonGroup
 * @scenario Related buttons fused into one visual unit (joined borders/radius) — e.g. Save + dropdown Split action; distinct from Toolbar/ToggleGroup because there is no pressed state.
 */
import { Button, ButtonGroup } from "@monkey-mini-app/ui";

export default function ButtonGroup01Example() {
  return (
    <>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="primitive-button">Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <ButtonGroup>
            <Button variant="outline">One</Button>
            <Button variant="outline">Two</Button>
          </ButtonGroup>
        </div>
    </>
  );
}
