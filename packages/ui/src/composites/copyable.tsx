"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@monkey-mini-app/ui/components/input-group"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"

export function Copyable({ value }: { value: string }) {
  const t = useLabels("copyable")
  const [copied, setCopied] = React.useState(false)
  return (
    <InputGroup data-testid="copyable">
      <InputGroupInput readOnly value={value} />
      <InputGroupAddon align="inline-end">
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label={t.copy}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  )
}
