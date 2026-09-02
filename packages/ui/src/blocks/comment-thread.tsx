import { Avatar, AvatarFallback } from "@monkey-mini-app/ui/components/avatar"

export type Comment = { id: string; author: string; body: string; time?: string }

/**
 * Nested comments with author + time.
 * @when Issue/ticket discussion, review comments. Editing a comment is your job, not the component's.
 * @example
 * <CommentThread comments={[{ id: "c1", author: "P.Wang", text: "这里再确认下" }]} />
 * @family Realtime
 */
export function CommentThread({ comments }: { comments: Comment[] }) {
  return (
    <div className="flex flex-col gap-3" data-testid="comment-thread">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">
              {comment.author.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium">
              {comment.author}
              {comment.time ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {comment.time}
                </span>
              ) : null}
            </div>
            <p className="text-sm">{comment.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
