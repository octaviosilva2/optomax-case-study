import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Input
 * DESIGN.md seção 4: Input
 * - Focus: ring-2 ring-ring border-transparent
 * - Placeholder: text-muted-foreground/60
 * - Padding: px-3 py-2 (h-9 com text-sm)
 * V1: mantém px-2.5 py-1 + ring-3 + placeholder sem /60
 * V2: overrides via CSS condicional em globals.css
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // V1: px-2.5 py-1, ring-3, placeholder sem /60 (original)
        // V2: px-3 py-2, ring-2, placeholder/60 via globals.css
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
