"use client"

import * as React from "react"
import { Input } from "@/shared/ui/input"
import { cn } from "@/shared/lib/utils"

type NumericQuantityInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode"
>

/**
 * Mobile-friendly quantity input — keeps numeric keypad open while typing.
 * Uses type="tel" while focused (iOS/Android); React state prevents type reset on re-render.
 */
export function NumericQuantityInput({
  className,
  onFocus,
  onBlur,
  ...props
}: NumericQuantityInputProps) {
  const [isFocused, setIsFocused] = React.useState(false)

  return (
    <Input
      {...props}
      type={isFocused ? "tel" : "text"}
      inputMode="decimal"
      pattern="[0-9.,]*"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      className={cn(className)}
      onFocus={(event) => {
        setIsFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setIsFocused(false)
        onBlur?.(event)
      }}
    />
  )
}
