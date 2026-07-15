'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ItemAvaliacao } from '@/components/clinical/ItemAvaliacao'
import type { CamposVisuais, ItemAvaliacao as ItemAvaliacaoType } from '@/types/clinical'

type Props = {
  value: Partial<CamposVisuais>
  onChange: (parcial: Partial<CamposVisuais>) => void
  disabled?: boolean
}

export function SecaoCamposVisuais({ value, onChange, disabled }: Props) {
  const update = (p: Partial<CamposVisuais>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Campos visuais</h2>
        <p className="text-xs text-muted-foreground">Teste de confrontação por olho.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ItemAvaliacao
          id="cv-od"
          label="OD"
          value={(value.od ?? {}) as Partial<ItemAvaliacaoType>}
          onChange={(p) => update({ od: { ...(value.od ?? {}), ...p } as ItemAvaliacaoType })}
          disabled={disabled}
          observacaoCondicional
        />
        <ItemAvaliacao
          id="cv-oe"
          label="OE"
          value={(value.oe ?? {}) as Partial<ItemAvaliacaoType>}
          onChange={(p) => update({ oe: { ...(value.oe ?? {}), ...p } as ItemAvaliacaoType })}
          disabled={disabled}
          observacaoCondicional
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-cv">Observações gerais</Label>
        <Textarea
          id="obs-cv"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
