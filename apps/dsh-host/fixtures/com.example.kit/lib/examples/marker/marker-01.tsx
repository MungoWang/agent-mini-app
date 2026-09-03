/**
 * @exampleOf Marker
 * @title Marker
 * @scenario Small inline marker (icon + text) used to annotate a list row or timeline step with its state/file type.
 */
import { Marker, MarkerContent } from "@monkey-mini-app/ui";

export default function Marker01Example() {
  return (
    <>
      <Marker>
        <MarkerContent>Explored 4 files</MarkerContent>
      </Marker>
    </>
  );
}
