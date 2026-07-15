import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Badge variants
// DESIGN.md seção 4: Badge/Pill
// - Status clínico: bg-status-{status}/15 text-status-{status} border border-status-{status}/30 rounded-md
// - Pro/admin: bg-accent/20 text-accent-foreground border border-accent/40
// - Meta neutra: bg-muted text-muted-foreground
// - Sempre acompanhar ícone Lucide 12px à esquerda quando representa status
// V1: mantém rounded-4xl (pill) para variantes originais
// V2: status usa rounded-md via classe específica
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Variantes originais (V1) — mantém rounded-4xl (pill)
        default: "rounded-4xl bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "rounded-4xl bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "rounded-4xl bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 hover:bg-destructive/20",
        outline:
          "rounded-4xl border-border text-foreground hover:bg-muted hover:text-muted-foreground",
        ghost:
          "rounded-4xl hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "rounded-4xl text-primary underline-offset-4 hover:underline",
        "primary-subtle":
          "rounded-4xl bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/80",
        // Variante muted (meta neutra) — DESIGN.md
        muted: "rounded-md bg-muted text-muted-foreground",
        // Variante accent (pro/admin badge) — DESIGN.md
        accent: "rounded-md bg-accent/20 text-accent-foreground border-accent/40",
        // Variantes de status clínico — DESIGN.md
        // Usam tokens --status-* definidos em globals.css
        "status-ok": "rounded-md bg-status-ok-bg text-status-ok border-status-ok/30",
        "status-warning": "rounded-md bg-status-warning-bg text-status-warning border-status-warning/30",
        "status-critical": "rounded-md bg-status-critical-bg text-status-critical border-status-critical/30",
        "status-pending": "rounded-md bg-status-pending-bg text-status-pending border-status-pending/30",
        "status-info": "rounded-md bg-status-info-bg text-status-info border-status-info/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
