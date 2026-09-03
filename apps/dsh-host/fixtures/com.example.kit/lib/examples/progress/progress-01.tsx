/**
 * @exampleOf Progress
 * @title Progress
 * @scenario Determinate percentage bar for a known-length task (upload, batch done/total); use Spinner when progress is unknown.
 */
import { Progress } from "@monkey-mini-app/ui";

export default function Progress01Example() {
  return <Progress value={48} />;
}
