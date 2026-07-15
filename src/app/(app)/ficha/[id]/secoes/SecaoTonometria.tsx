'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tonometria } from '@/types/clinical'

type Props = {
  value: Partial<Tonometria>
  onChange: (parcial: Partial<Tonometria>) => void
  disabled?: boolean
}

export function SecaoTonometria({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Tonometria>) => onChange({ ...value, ...p })

  function updatePIO(campo: 'od_pio' | 'oe_pio', raw: string) {
    const num = raw.trim() === '' ? null : Number(raw)
    if (num !== null && Number.isNaN(num)) return
    update({ [campo]: num })
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Tonometria</h2>
        <p className="text-xs text-muted-foreground">Pressão intraocular (PIO) em mmHg.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pio-od">PIO OD</Label>
          <Input
            id="pio-od"
            type="number"
            inputMode="decimal"
            min={5}
            max={50}
            step={0.5}
            placeholder="preencher"
            disabled={disabled}
            value={value.od_pio ?? ''}
            onChange={(e) => updatePIO('od_pio', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pio-oe">PIO OE</Label>
          <Input
            id="pio-oe"
            type="number"
            inputMode="decimal"
            min={5}
            max={50}
            step={0.5}
            placeholder="preencher"
            disabled={disabled}
            value={value.oe_pio ?? ''}
            onChange={(e) => updatePIO('oe_pio', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Método</Label>
          <Select
            disabled={disabled}
            value={value.metodo ?? ''}
            onValueChange={(v) => update({ metodo: (v || null) as Tonometria['metodo'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aplanacao">Aplanação (Goldmann)</SelectItem>
              <SelectItem value="sopro">Sopro de ar</SelectItem>
              <SelectItem value="identacao">Identação (Schiötz)</SelectItem>
              <SelectItem value="rebote">Rebote (iCare)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ton-hora">Horário da medição</Label>
          <Input
            id="ton-hora"
            type="time"
            disabled={disabled}
            value={value.horario ?? ''}
            onChange={(e) => update({ horario: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-ton">Observações</Label>
        <Textarea
          id="obs-ton"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
