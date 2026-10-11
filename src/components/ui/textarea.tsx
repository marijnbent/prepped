import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground/70 hover:border-muted-foreground focus-visible:border-foreground aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[20px] border bg-transparent px-4 py-3 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
