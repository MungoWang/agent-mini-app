/**
 * @group primitives
 * @title Badge / Avatar / Kbd
 * @scenario Inline identity atoms: Badge for labels/counts, Avatar with initials fallback when a picture is missing, Kbd for shortcuts.
 */
import { Avatar, AvatarFallback, Badge, Kbd } from "@monkey-mini-app/ui";

export default function MiscPrimitives01Example() {
  return (
    <>
        <div className="flex items-center gap-2">
          <Badge>New</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Avatar className="size-8">
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <Kbd>⌘K</Kbd>
        </div>
    </>
  );
}
