'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ItemAvaliacao } from '@/components/clinical/ItemAvaliacao'
import type { AvaliacaoMotora, ItemAvaliacao as ItemAvaliacaoType } from '@/types/clinical'

type Props = {
  value: Partial<AvaliacaoMotora>
  onChange: (parcial: Partial<AvaliacaoMotora>) => void
  disabled?: boolean
}

export function SecaoAvaliacaoMotora({ value, onChange, disabled }: Props) {
  const update = (p: Partial<AvaliacaoMotora>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Avaliação motora</h2>
        <p className="text-xs text-muted-foreground">Ducções e versões — movimentos oculares extrínsecos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ItemAvaliacao
          id="am-duccoes"
          label="Ducções"
          value={value.duccoes ?? {}}
          onChange={(p) => update({ duccoes: { ...(value.duccoes ?? {}), ...p } as ItemAvaliacaoType })}
          disabled={disabled}
          observacaoCondicional
        />
        <ItemAvaliacao
          id="am-versoes"
          label="Versões"
          value={value.versoes ?? {}}
          onChange={(p) => update({ versoes: { ...(value.versoes ?? {}), ...p } as ItemAvaliacaoType })}
          disabled={disabled}
          observacaoCondicional
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-am">Observações</Label>
        <Textarea
          id="obs-am"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
