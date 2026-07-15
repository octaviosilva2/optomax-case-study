'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { RetinoscopiaDinamica } from '@/types/clinical'

type Props = {
  value: Partial<RetinoscopiaDinamica>
  onChange: (parcial: Partial<RetinoscopiaDinamica>) => void
  disabled?: boolean
}

export function SecaoRetinoscopiaDinamica({ value, onChange, disabled }: Props) {
  const update = (p: Partial<RetinoscopiaDinamica>) => onChange({ ...value, ...p })

  function updateValor(campo: 'od_valor' | 'oe_valor', raw: string) {
    const num = raw.trim() === '' ? null : Number(raw)
    if (num !== null && Number.isNaN(num)) return
    update({ [campo]: num })
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Retinoscopia dinâmica</h2>
        <p className="text-xs text-muted-foreground">Avaliação acomodativa (lag de acomodação) em dioptrias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ret-din-od">OD</Label>
          <Input
            id="ret-din-od"
            type="number"
            inputMode="decimal"
            min={-5}
            max={5}
            step={0.25}
            placeholder="informar"
            disabled={disabled}
            value={value.od_valor ?? ''}
            onChange={(e) => updateValor('od_valor', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ret-din-oe">OE</Label>
          <Input
            id="ret-din-oe"
            type="number"
            inputMode="decimal"
            min={-5}
            max={5}
            step={0.25}
            placeholder="informar"
            disabled={disabled}
            value={value.oe_valor ?? ''}
            onChange={(e) => updateValor('oe_valor', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-ret-din">Observações</Label>
        <Textarea
          id="obs-ret-din"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
