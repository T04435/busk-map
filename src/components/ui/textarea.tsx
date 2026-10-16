import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
         "flex field-sizing-content min-h-24 w-full rounded-none border-2 border-input bg-card px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:border-input aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
