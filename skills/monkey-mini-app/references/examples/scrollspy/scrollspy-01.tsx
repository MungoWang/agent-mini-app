/**
 * @exampleOf Scrollspy
 * @title Scrollspy
 * @scenario Section nav that highlights whichever section is currently in view — long settings/docs pages; wire it to element ids.
 */
import { Scrollspy } from "@monkey-mini-app/ui";

export default function Scrollspy01Example() {
  return (
    <>
      <div className="grid grid-cols-[8rem_1fr] gap-4">
        <Scrollspy
          sections={[
            { id: "alpha", label: "Alpha" },
            { id: "beta", label: "Beta" },
          ]}
        />
        <div className="h-32 overflow-auto text-sm">
          <div id="alpha" className="h-24">
            Alpha section
          </div>
          <div id="beta" className="h-24">
            Beta section
          </div>
        </div>
      </div>
    </>
  );
}
