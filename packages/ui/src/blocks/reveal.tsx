import { motion, useReducedMotion } from "motion/react"

import { cn } from "../lib/utils"

/**
 * Entrance reveal — fade and rise, with a per-item `delay` for a stagger.
 *
 * This is the kit's front door to the platform `motion` build (`/mma/vendors/motion.js`,
 * one shared React). Use it for the common case and reach for
 * `import { motion, AnimatePresence } from "motion/react"` when you need exit, layout,
 * or gesture animation — `AnimatePresence` in particular is what keeps a removing row
 * from vanishing mid-transition.
 *
 * @when A card, row, or section appearing on first paint or after a filter change. Not
 *   for a hover/press response (one property: use a Tailwind `transition`) and not for
 *   animating an element out (use `AnimatePresence`).
 * @example
 * {rows.map((r, i) => (
 *   <Reveal key={r.id} delay={i * 60}>
 *     <Card>{r.title}</Card>
 *   </Reveal>
 * ))}
 * @family Animation
 */
export function Reveal({
  children,
  delay = 0,
  distance = 8,
  className,
  style,
}: {
  children: React.ReactNode
  /** Stagger in ms — pass `i * 60` for a list. */
  delay?: number
  /** Rise distance in px. `0` fades in place. */
  distance?: number
  className?: string
  style?: React.CSSProperties
}) {
  // OS "reduce motion" wins over the design: no travel, no stagger, just present.
  const reduce = useReducedMotion()
  return (
    <motion.div
      data-mma-reveal=""
      className={cn(className)}
      style={style}
      initial={reduce ? false : { opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.32, delay: delay / 1000, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  )
}
