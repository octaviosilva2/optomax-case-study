'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Diagnostico } from '@/types/clinical'

type Props = {
  value: Partial<Diagnostico>
  onChange: (parcial: Partial<Diagnostico>) => void
  disabled?: boolean
}

export function SecaoDiagnostico({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Diagnostico>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Diagnóstico</h2>
        <p className="text-xs text-muted-foreground">Hipóteses diagnósticas e CID-10 (opcional).</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="diag-hip">Hipóteses diagnósticas</Label>
        <Textarea
          id="diag-hip"
          rows={4}
          disabled={disabled}
          value={value.hipoteses ?? ''}
          onChange={(e) => update({ hipoteses: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="diag-cid">CID-10 (opcional)</Label>
        <Input
          id="diag-cid"
          placeholder="ex: H52.0; H52.1"
          disabled={disabled}
          value={value.cid ?? ''}
          onChange={(e) => update({ cid: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-diag">Observações</Label>
        <Textarea
          id="obs-diag"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
