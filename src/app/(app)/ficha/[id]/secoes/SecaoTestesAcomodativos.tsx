'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TestesAcomodativos } from '@/types/clinical'

type Props = {
  value: Partial<TestesAcomodativos>
  onChange: (parcial: Partial<TestesAcomodativos>) => void
  disabled?: boolean
}

export function SecaoTestesAcomodativos({ value, onChange, disabled }: Props) {
  const update = (p: Partial<TestesAcomodativos>) => onChange({ ...value, ...p })

  function updateAA(campo: 'aa_od' | 'aa_oe' | 'aa_ao', raw: string) {
    const num = raw.trim() === '' ? null : Number(raw)
    if (num !== null && Number.isNaN(num)) return
    update({ [campo]: num })
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Testes acomodativos</h2>
        <p className="text-xs text-muted-foreground">Amplitude de acomodação (Donders / push-up) e facilidade.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="aa-od">AA OD (D)</Label>
          <Input
            id="aa-od"
            type="number"
            inputMode="decimal"
            min={0}
            max={30}
            step={0.25}
            disabled={disabled}
            value={value.aa_od ?? ''}
            onChange={(e) => updateAA('aa_od', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-oe">AA OE (D)</Label>
          <Input
            id="aa-oe"
            type="number"
            inputMode="decimal"
            min={0}
            max={30}
            step={0.25}
            disabled={disabled}
            value={value.aa_oe ?? ''}
            onChange={(e) => updateAA('aa_oe', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-ao">AA AO (D)</Label>
          <Input
            id="aa-ao"
            type="number"
            inputMode="decimal"
            min={0}
            max={30}
            step={0.25}
            disabled={disabled}
            value={value.aa_ao ?? ''}
            onChange={(e) => updateAA('aa_ao', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fac-acom">Facilidade acomodativa</Label>
        <Input
          id="fac-acom"
          placeholder="ex: 8 cpm OD, 10 cpm OE"
          disabled={disabled}
          value={value.facilidade_acomodativa ?? ''}
          onChange={(e) => update({ facilidade_acomodativa: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-acom">Observações</Label>
        <Textarea
          id="obs-acom"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
