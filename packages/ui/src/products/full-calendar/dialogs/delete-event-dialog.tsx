import { TrashIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@monkey-mini-app/ui/components/alert-dialog"
import { useCalendar } from "../contexts/calendar-context"

export default function DeleteEventDialog({ eventId }: { eventId: number }) {
  const { removeEvent } = useCalendar()
  if (!eventId) return null
  return (
    <AlertDialog>
      <AlertDialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 text-sm text-destructive">
        <TrashIcon className="size-4" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your event.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => removeEvent(eventId)}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
