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
import type { DioptriaAtual } from '@/types/clinical'

type Props = {
  value: Partial<DioptriaAtual>
  onChange: (parcial: Partial<DioptriaAtual>) => void
  disabled?: boolean
  erros?: Record<string, string>
}

export function SecaoDioptriaAtual({ value, onChange, disabled, erros = {} }: Props) {
  const update = (p: Partial<DioptriaAtual>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">Dioptria atual</h2>
      <p className="text-xs text-muted-foreground">
        Refração que o paciente está utilizando atualmente (lente em uso).
      </p>

      {/* Grade 2×5 reutilizável de OD/OE × ESF/CIL/EIXO/DNP/ADD */}
      <DioptriasGrid
        value={{ od: value.od, oe: value.oe }}
        onChange={(olhos) => update(olhos)}
        disabled={disabled}
        erros={erros}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de lente</Label>
          <Select
            disabled={disabled}
            value={value.tipo_lente ?? ''}
            onValueChange={(v) =>
              update({ tipo_lente: v as DioptriaAtual['tipo_lente'] })
            }
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-dpt">Observações</Label>
        <Textarea
          id="obs-dpt"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
