/**
 * @exampleOf Skeleton
 * @title Skeleton
 * @scenario Loading placeholder shaped like the content that will replace it (cards/rows), avoiding layout jump on first paint.
 */
import { Skeleton } from "@monkey-mini-app/ui";

export default function Skeleton01Example() {
  return (
    <Skeleton className="h-6 w-48" />
  );
}
