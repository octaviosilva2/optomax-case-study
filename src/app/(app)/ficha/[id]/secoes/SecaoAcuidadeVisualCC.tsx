'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AcuidadeVisualGrid } from '@/components/clinical/AcuidadeVisualGrid'
import type { AcuidadeVisual } from '@/types/clinical'

type Props = {
  value: Partial<AcuidadeVisual>
  onChange: (parcial: Partial<AcuidadeVisual>) => void
  disabled?: boolean
}

export function SecaoAcuidadeVisualCC({ value, onChange, disabled }: Props) {
  const update = (p: Partial<AcuidadeVisual>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Acuidade visual com correção</h2>
        <p className="text-xs text-muted-foreground">Medida usando os óculos atuais do paciente.</p>
      </div>

      <AcuidadeVisualGrid value={value} onChange={onChange} disabled={disabled} />

      <div className="space-y-2">
        <Label htmlFor="obs-av-cc">Observações</Label>
        <Textarea
          id="obs-av-cc"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
