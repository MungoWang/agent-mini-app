import { cn } from "@monkey-mini-app/ui/lib/utils"

/**
 * Pulse placeholder block.
 * @when First paint while `call()` is pending — match the real layout's size.
 * @example
 * <div className="flex flex-col gap-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
 * @family Feedback & status
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
