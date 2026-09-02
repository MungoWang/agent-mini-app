import { Avatar, AvatarFallback, AvatarImage } from "@monkey-mini-app/ui/components/avatar";
import { AvatarGroup } from "../shims/avatar-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monkey-mini-app/ui/components/select";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { useCalendar } from "../contexts/calendar-context";

export function UserSelect() {
  const { users, selectedUserId, filterEventsBySelectedUser } = useCalendar();
  const t = useLabels("eventCalendar");

  return (
    <Select value={selectedUserId!} onValueChange={(value) => value && filterEventsBySelectedUser(value)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t.selectUser} />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">
          <AvatarGroup className="mx-2 flex items-center" max={3}>
            {users.map((user) => (
              <Avatar key={user.id} className="size-6 text-xxs">
                <AvatarImage
                  src={user.picturePath ?? undefined}
                  alt={user.name}
                />
                <AvatarFallback className="text-xxs">
                  {user.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
          {t.allUsers}
        </SelectItem>

        {users.map((user) => (
          <SelectItem
            key={user.id}
            value={user.id}
            className="flex-1 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Avatar key={user.id} className="size-6">
                <AvatarImage
                  src={user.picturePath ?? undefined}
                  alt={user.name}
                />
                <AvatarFallback className="text-xxs">
                  {user.name[0]}
                </AvatarFallback>
              </Avatar>

              <p className="truncate">{user.name}</p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
