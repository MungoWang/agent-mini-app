import * as React from "react"

function strip(props: Record<string, unknown>) {
  const {
    initial: _i,
    animate: _a,
    exit: _e,
    variants: _v,
    transition: _t,
    whileHover: _h,
    whileTap: _p,
    layout: _l,
    scrollPosition: _s,
    ...rest
  } = props
  return rest
}

function make(tag: React.ElementType) {
  const El = React.forwardRef(function MotionEl(props: Record<string, unknown>, ref: React.Ref<unknown>) {
    return React.createElement(tag, { ...strip(props), ref })
  })
  El.displayName = `motion.${typeof tag === "string" ? tag : "el"}`
  return El
}

/**
 * One component per tag, cached.
 *
 * Without the cache `motion.div` returns a NEW component type on every property
 * access, so React sees a different `type` each render and tears the subtree down:
 * DOM refs held across renders (pointer capture, `getBoundingClientRect` during a
 * drag) then point at detached nodes, and every `motion.*` descendant remounts on
 * each state change. Keep this memoised.
 */
const byTag = new Map<string, React.ElementType>()
const byComponent = new Map<React.ElementType, React.ElementType>()

function forTag(tag: string): React.ElementType {
  let el = byTag.get(tag)
  if (!el) {
    el = make(tag as React.ElementType)
    byTag.set(tag, el)
  }
  return el
}

function forComponent(comp: React.ElementType): React.ElementType {
  let el = byComponent.get(comp)
  if (!el) {
    el = make(comp)
    byComponent.set(comp, el)
  }
  return el
}

export const motion = new Proxy(
  { create: (comp: React.ElementType) => forComponent(comp) },
  {
    get(target, key) {
      if (key === "create") return target.create
      if (typeof key === "string") return forTag(key)
      return undefined
    },
  },
) as unknown as { create: (comp: React.ElementType) => React.ElementType } & Record<string, React.ElementType>

export function AnimatePresence({ children }: { children?: React.ReactNode; initial?: boolean; mode?: string }) {
  return <>{children}</>
}

export type Variants = Record<string, unknown>
