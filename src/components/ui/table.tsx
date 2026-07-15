"use client"

/**
 * Table components
 * DESIGN.md seção 4: Table
 * - Cabeçalho: Inter text-xs uppercase tracking-wide text-muted-foreground font-medium
 * - Linha: hover:bg-muted/50, border-b border-border
 * - Densidade padrão: py-3 px-4 (linha 44px)
 * - Densidade alta: py-2 px-3 (linha 36px) — aplicar via prop density="dense" futura
 * - Colunas numéricas: text-right tabular-nums font-mono (aplicado pelo consumidor)
 * - Sticky header: sticky top-0 bg-card z-10 (aplicar via className no consumidor)
 * TODO Fase 6: prop density="default" | "dense" no Table
 */

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * TableRow
 * DESIGN.md: hover:bg-muted/50, border-b border-border
 * V1: mantém border-b (sem border-border explícito), V2: adiciona border-border via CSS se necessário
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // V1: border-b original (usa cor default), já OK para ambos
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

/**
 * TableHead
 * DESIGN.md: text-xs uppercase tracking-wide text-muted-foreground font-medium
 * V1: mantém px-2 text-foreground (original)
 * V2: px-4 + text-xs uppercase tracking-wide text-muted-foreground via CSS override em globals.css
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // V1: px-2 text-foreground (original), V2: estilos DESIGN.md via globals.css
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * TableCell
 * DESIGN.md: py-3 px-4 (linha 44px padrão)
 * V1: mantém p-2 original, V2: py-3 px-4 via CSS override em globals.css
 * Consumidor aplica text-right tabular-nums font-mono em colunas numéricas
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        // V1: p-2 (original), V2: py-3 px-4 via globals.css
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
