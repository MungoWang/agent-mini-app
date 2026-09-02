import { cn } from "@monkey-mini-app/ui/lib/utils"
import { Loader2Icon } from "lucide-react"

/**
 * @family Feedback & status
 * @when Inside a button while `call()` is pending. Known % → `Progress`.
 * @example
 * <Button disabled><Spinner /> 保存中</Button>
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
