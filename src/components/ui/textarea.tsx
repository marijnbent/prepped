import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input/80 placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-primary/15 focus-visible:bg-background aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl border bg-secondary/30 px-3.5 py-2.5 text-base shadow-xs transition-all duration-200 outline-none focus-visible:ring-[3px] hover:border-input hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
