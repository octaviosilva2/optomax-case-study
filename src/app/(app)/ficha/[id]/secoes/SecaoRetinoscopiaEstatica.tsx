'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { RetinoscopiaEstatica } from '@/types/clinical'

type Props = {
  value: Partial<RetinoscopiaEstatica>
  onChange: (parcial: Partial<RetinoscopiaEstatica>) => void
  disabled?: boolean
}

export function SecaoRetinoscopiaEstatica({ value, onChange, disabled }: Props) {
  const update = (p: Partial<RetinoscopiaEstatica>) => onChange({ ...value, ...p })

  // Coerção defensiva: fichas antigas podem trazer um objeto (CampoRefracao) em od/oe.
  // Para a UI, exibimos vazio nesses casos — o preprocess do Zod faz a mesma coerção no save.
  function valorString(raw: unknown): string {
    if (raw === null || raw === undefined) return ''
    if (typeof raw === 'string') return raw
    return ''
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Retinoscopia estática</h2>
        <p className="text-xs text-muted-foreground">Refração objetiva sob fixação distante — preenchimento livre por olho.</p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
          <Label htmlFor="ret-est-od" className="text-sm font-semibold text-foreground">OD</Label>
          <Input
            id="ret-est-od"
            disabled={disabled}
            value={valorString(value.od)}
            onChange={(e) => update({ od: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
          <Label htmlFor="ret-est-oe" className="text-sm font-semibold text-foreground">OE</Label>
          <Input
            id="ret-est-oe"
            disabled={disabled}
            value={valorString(value.oe)}
            onChange={(e) => update({ oe: e.target.value })}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-ret-est">Observações</Label>
        <Textarea
          id="obs-ret-est"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
