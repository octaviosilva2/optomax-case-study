'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DioptriasGrid } from '@/components/clinical/DioptriasGrid'
import type { Lensometria } from '@/types/clinical'

type Props = {
  value: Partial<Lensometria>
  onChange: (parcial: Partial<Lensometria>) => void
  disabled?: boolean
}

export function SecaoLensometria({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Lensometria>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Lensometria / Dioptria atual</h2>
        <p className="text-xs text-muted-foreground">Leitura do óculos atual e dioptria em uso.</p>
      </div>

      <DioptriasGrid
        value={{ od: value.od, oe: value.oe }}
        onChange={(olhos) => update(olhos)}
        disabled={disabled}
      />

      <div className="space-y-2">
        <Label>Tipo de lente</Label>
        <Select
          disabled={disabled}
          value={value.tipo_lente ?? ''}
          onValueChange={(v) => update({ tipo_lente: (v || null) as Lensometria['tipo_lente'] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monofocal">Monofocal</SelectItem>
            <SelectItem value="bifocal">Bifocal</SelectItem>
            <SelectItem value="multifocal">Multifocal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-lens">Observações</Label>
        <Textarea
          id="obs-lens"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
