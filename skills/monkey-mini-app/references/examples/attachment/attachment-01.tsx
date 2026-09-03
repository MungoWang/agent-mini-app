/**
 * @exampleOf Attachment
 * @title Attachment
 * @scenario A file chip in a list — icon, name, meta line and a remove affordance; the shape used for uploaded files or chat attachments.
 */
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentTitle } from "@monkey-mini-app/ui";

export default function Attachment01Example() {
  return (
    <>
      <Attachment>
        <AttachmentContent>
          <AttachmentTitle>report.pdf</AttachmentTitle>
          <AttachmentDescription>PDF · 120 KB</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </>
  );
}
