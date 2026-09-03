/**
 * @exampleOf FileDropzone
 * @title FileDropzone
 * @scenario Drag-drop or click-to-pick file list with per-file name/size and a clear action; the UI half only — upload belongs in main.api.ts.
 */
import * as React from "react";

import { FileDropzone } from "@monkey-mini-app/ui";

export default function FileDropzone01Example() {
  const [files, setFiles] = React.useState<File[]>([]);

  return <FileDropzone files={files} onFiles={setFiles} />;
}
