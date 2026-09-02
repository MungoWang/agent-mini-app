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

export const motion = new Proxy(
  { create: (comp: React.ElementType) => make(comp) },
  {
    get(target, key) {
      if (key === "create") return target.create
      if (typeof key === "string") return make(key as unknown as React.ElementType)
      return undefined
    },
  },
) as unknown as { create: (comp: React.ElementType) => React.ElementType } & Record<string, React.ElementType>

export function AnimatePresence({ children }: { children?: React.ReactNode; initial?: boolean; mode?: string }) {
  return <>{children}</>
}

export type Variants = Record<string, unknown>
