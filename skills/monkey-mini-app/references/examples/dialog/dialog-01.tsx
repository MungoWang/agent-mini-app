/**
 * @exampleOf Dialog
 * @title Dialog
 * @scenario Modal flow with trigger/content/header/footer composition and focus trapping; the base for forms that must interrupt the page.
 */
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@monkey-mini-app/ui";

export default function Dialog01Example() {
  return (
    <>
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit run</DialogTitle>
              <DialogDescription>Change metadata and save.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
    </>
  );
}
