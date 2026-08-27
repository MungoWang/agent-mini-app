"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@monkey-mini-app/ui/components/input-group"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function PasswordField({
  value,
  onChange,
}: {
  value?: string
  onChange?: (value: string) => void
}) {
  const t = useLabels("passwordField")
  const [visible, setVisible] = React.useState(false)
  return (
    <InputGroup data-testid="password-field">
      <InputGroupInput
        type={visible ? "text" : "password"}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        autoComplete="current-password"
      />
      <InputGroupAddon align="inline-end">
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label={visible ? t.hide : t.show}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  )
}
