'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { HistoricoObservacoes } from '@/types/clinical'

type Props = {
  value: Partial<HistoricoObservacoes>
  onChange: (parcial: Partial<HistoricoObservacoes>) => void
  disabled?: boolean
}

export function SecaoHistoricoObservacoes({ value, onChange, disabled }: Props) {
  const update = (p: Partial<HistoricoObservacoes>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">
        Conduta e observações clínicas
      </h2>

      <div className="space-y-2">
        <Label htmlFor="conduta">Conduta</Label>
        <Textarea
          id="conduta"
          rows={3}
          disabled={disabled}
          value={value.conduta ?? ''}
          onChange={(e) => update({ conduta: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-clin">Observações clínicas</Label>
        <Textarea
          id="obs-clin"
          rows={4}
          disabled={disabled}
          value={value.observacoes_clinicas ?? ''}
          onChange={(e) => update({ observacoes_clinicas: e.target.value })}
        />
      </div>

      <div className="space-y-2 max-w-sm">
        <Label htmlFor="retorno">Retorno recomendado</Label>
        <Input
          id="retorno"
          disabled={disabled}
          value={value.retorno_recomendado ?? ''}
          onChange={(e) => update({ retorno_recomendado: e.target.value })}
          placeholder="ex: 6 meses"
        />
      </div>
    </section>
  )
}
