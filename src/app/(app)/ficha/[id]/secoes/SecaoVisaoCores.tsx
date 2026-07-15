'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { VisaoCores } from '@/types/clinical'

type Props = {
  value: Partial<VisaoCores>
  onChange: (parcial: Partial<VisaoCores>) => void
  disabled?: boolean
}

export function SecaoVisaoCores({ value, onChange, disabled }: Props) {
  const update = (p: Partial<VisaoCores>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Visão de cores</h2>
        <p className="text-xs text-muted-foreground">Teste utilizado e resultado por olho.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vc-teste">Teste utilizado</Label>
        <Input
          id="vc-teste"
          placeholder="ex: Ishihara, Farnsworth"
          disabled={disabled}
          value={value.teste_usado ?? ''}
          onChange={(e) => update({ teste_usado: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vc-od">Resultado OD</Label>
          <Input
            id="vc-od"
            placeholder="ex: 12/14"
            disabled={disabled}
            value={value.resultado_od ?? ''}
            onChange={(e) => update({ resultado_od: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vc-oe">Resultado OE</Label>
          <Input
            id="vc-oe"
            placeholder="ex: 12/14"
            disabled={disabled}
            value={value.resultado_oe ?? ''}
            onChange={(e) => update({ resultado_oe: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-vc">Observações</Label>
        <Textarea
          id="obs-vc"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
