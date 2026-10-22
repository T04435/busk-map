"use client"

import * as React from "react"
import { cn } from "cn"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { Hex } from "@/components/honeycomb/hex-cell"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  // asChild: the child is the whole choice (a slot card); it draws its own picked state from aria-checked.
  if (asChild) {
    return (
      <RadioGroupPrimitive.Item asChild data-slot="radio-group-item" className={className} {...props}>
        {children}
      </RadioGroupPrimitive.Item>
    )
  }
  // The choice card shows the focus (.bm-choice:focus-within, in choice-cards.tsx), not the radio.
  // A cell inside a cell: the outer honeycomb is the choice, the orange one inside says which is picked.
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative inline-grid h-[25px] w-[22px] shrink-0 place-items-center rounded-none border-0 bg-transparent p-0 [--hex-fill:var(--card)] [--hex-stroke:var(--input)] [--hex-sw:3px] focus-visible:shadow-none focus-visible:outline-none after:absolute after:-inset-3 disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:[--hex-stroke:var(--destructive)] data-checked:[--hex-stroke:var(--foreground)] data-checked:[--hex-sw:4px]",
        className
      )}
      {...props}
    >
      <Hex />
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative block h-[11.5px] w-[10px] bg-primary [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
      />
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
