"use client"

import { Avatar, AvatarFallback } from "@monkey-mini-app/ui/components/avatar"
import { NativeSelect, NativeSelectOption } from "@monkey-mini-app/ui/components/native-select"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export type UserOption = { id: string; name: string }

/**
 * Pick a user from a list (avatar + name).
 * @when Assignee/owner fields; you supply the user list.
 * @example
 * <UserPicker users={[{ id: "u1", name: "张三" }]} onChange={(id) => set(id)} />
 * @family Form
 */
export function UserPicker({
  users,
  value,
  onChange,
}: {
  users: UserOption[]
  value?: string
  onChange?: (id: string) => void
}) {
  const t = useLabels("userPicker")
  const selected = users.find((user) => user.id === value)
  return (
    <div className="flex items-center gap-2" data-testid="user-picker">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">
          {(selected?.name ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <NativeSelect
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <NativeSelectOption value="">{t.placeholder}</NativeSelectOption>
        {users.map((user) => (
          <NativeSelectOption key={user.id} value={user.id}>
            {user.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
