"use client";

import * as React from "react";
import type { FormEvent, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@monkey-mini-app/ui/components/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@monkey-mini-app/ui/components/sheet";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type FormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Anything below the title: a badge, a record id, a tab strip. */
  header?: ReactNode;
  /** The scrolling form fields. */
  children: ReactNode;
  /** Action row, pinned. Put the primary control in here with `type="submit"`. */
  footer?: ReactNode;
  /** One submit path for the whole sheet: Enter in a field and the footer button land here. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  side?: "top" | "right" | "bottom" | "left";
  width?: string | number;
  /** Ask before throwing edits away. The app owns the check; the preset owns the prompt. */
  dirty?: boolean;
  className?: string;
};

/**
 * Create / edit form over a list you do not want to lose.
 *
 * The usual build has three cracks: the header and footer scroll away with the fields (so the
 * Cancel button is somewhere the user has to hunt for), Enter in a text field submits *something
 * else* or nothing because there is no form around the inputs, and Escape closes a sheet full of
 * unsaved edits. Here only the body is a scroller — header, form and footer are siblings inside a
 * flex column — the fields and the footer share one `<form onSubmit>`, and a dirty sheet asks
 * first.
 *
 * @when Page shape: focused create/edit over a list — new record, edit record, wizard-less config
 * @example
 * <FormSheet
 *   open={Boolean(editing)}
 *   onOpenChange={(o) => !o && setEditing(null)}
 *   title="Edit issue"
 *   dirty={dirty}
 *   onSubmit={save}
 *   footer={<Button type="submit">Save</Button>}
 * >
 *   <Input name="summary" />
 * </FormSheet>
 * @family Layout & structure
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  children,
  footer,
  onSubmit,
  side = "right",
  width = 480,
  dirty = false,
  className,
}: FormSheetProps) {
  const t = useLabels("formSheet");
  const [guard, setGuard] = React.useState(false);

  const request = (next: boolean) => {
    if (!next && dirty) {
      setGuard(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={request}>
        <SheetContent
          side={side}
          width={width}
          className={cn("flex min-h-0 flex-col gap-0 p-0", className)}
          data-testid="form-sheet"
        >
          <SheetHeader className="border-border shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
            {header}
          </SheetHeader>

          {/* One form wraps the scroller *and* the footer, so Enter and the button are the same path. */}
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit?.(e);
            }}
            data-testid="form-sheet-form"
          >
            <div
              className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
              data-testid="form-sheet-body"
            >
              {children}
            </div>
            {footer ? (
              <div
                className="border-border bg-background shrink-0 border-t px-6 py-3"
                data-testid="form-sheet-footer"
              >
                {footer}
              </div>
            ) : null}
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={guard} onOpenChange={setGuard}>
        <AlertDialogContent data-testid="form-sheet-guard">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.discardBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.keepEditing}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setGuard(false);
                onOpenChange(false);
              }}
            >
              {t.discard}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
