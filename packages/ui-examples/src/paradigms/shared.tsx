import * as React from "react";

/**
 * Entrance reveal comes from the kit, which sits on the platform `motion` build
 * (/mma/vendors/motion.js, one shared React). The demos used to hand-roll this with
 * `animate-in` + an inline `animationDelay`, which is the pattern that collides with a
 * theme switch — now there is one implementation to look at.
 */
export { Reveal } from "@monkey-mini-app/ui";

/** Count-up animation shared by the paradigm demos (a kit component later). */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Heading block that opens a style group */
export function StyleHeader({ name, desc, tag }: { name: string; desc: string; tag: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-xs font-semibold tracking-wide text-primary uppercase">{tag}</span>
      <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </div>
  );
}
