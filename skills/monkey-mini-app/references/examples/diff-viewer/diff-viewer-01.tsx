/**
 * @exampleOf DiffViewer
 * @title DiffViewer
 * @scenario Two strings side by side (unified/split) with added/removed counts — reviewing a config or code change before applying it.
 */
import { DiffViewer } from "@monkey-mini-app/ui";

export default function DiffViewer01Example() {
  return (
    <DiffViewer original={"a\nb\n"} modified={"a\nc\n"} />
  );
}
