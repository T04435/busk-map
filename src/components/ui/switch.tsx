"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

// Honeycomb switch: a square track with a honeycomb-cell thumb. On: a `primary` track and a `primary-foreground` cell.
// Off: a `muted` track, a 2px `input` border and a `muted-foreground` cell.
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-none border-2 transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-3 aria-invalid:border-destructive data-[size=default]:h-[26px] data-[size=default]:w-[46px] data-[size=sm]:h-[20px] data-[size=sm]:w-[34px] data-checked:border-(--fill-rule) data-checked:bg-primary data-unchecked:border-input data-unchecked:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block bg-muted-foreground transition-transform [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)] group-data-[size=default]/switch:h-[19px] group-data-[size=default]/switch:w-[17px] group-data-[size=sm]/switch:h-[14px] group-data-[size=sm]/switch:w-[12px] data-checked:bg-primary-foreground group-data-[size=default]/switch:data-checked:translate-x-[23px] group-data-[size=sm]/switch:data-checked:translate-x-[16px] data-unchecked:translate-x-[2px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
