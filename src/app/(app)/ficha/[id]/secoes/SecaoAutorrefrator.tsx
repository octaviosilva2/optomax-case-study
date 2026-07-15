'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RefracaoSimplesGrid } from '@/components/clinical/RefracaoSimplesGrid'
import type { Autorrefrator } from '@/types/clinical'

type Props = {
  value: Partial<Autorrefrator>
  onChange: (parcial: Partial<Autorrefrator>) => void
  disabled?: boolean
}

export function SecaoAutorrefrator({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Autorrefrator>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Autorrefrator</h2>
        <p className="text-xs text-muted-foreground">Medição automática objetiva.</p>
      </div>

      <RefracaoSimplesGrid
        value={{ od: value.od, oe: value.oe }}
        onChange={(olhos) => update(olhos as Partial<Autorrefrator>)}
        disabled={disabled}
      />

      <div className="space-y-2">
        <Label htmlFor="obs-auto">Observações</Label>
        <Textarea
          id="obs-auto"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
