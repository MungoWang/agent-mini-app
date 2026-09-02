import { cn } from "@monkey-mini-app/ui/lib/utils"

/**
 * @family Layout & structure
 * @when Keeping an image/video/embed from shifting the layout while loading.
 */
function AspectRatio({
  ratio,
  className,
  ...props
}: React.ComponentProps<"div"> & { ratio: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          "--ratio": ratio,
        } as React.CSSProperties
      }
      className={cn("relative aspect-(--ratio)", className)}
      {...props}
    />
  )
}

export { AspectRatio }
