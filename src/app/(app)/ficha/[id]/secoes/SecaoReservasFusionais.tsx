'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ReservasFusionais } from '@/types/clinical'

type Props = {
  value: Partial<ReservasFusionais>
  onChange: (parcial: Partial<ReservasFusionais>) => void
  disabled?: boolean
}

// 4 medidas livres (Etapa 5). Antes era tabela OD/OE × Rompimento/Recuperação com inputs numéricos.
const CAMPOS: Array<{ key: keyof Omit<ReservasFusionais, 'observacoes'>; sigla: string; descricao: string }> = [
  { key: 'rfpl', sigla: 'RFPL', descricao: 'Reservas fusionais positivas longe' },
  { key: 'rfpp', sigla: 'RFPP', descricao: 'Reservas fusionais positivas perto' },
  { key: 'rfnl', sigla: 'RFNL', descricao: 'Reservas fusionais negativas longe' },
  { key: 'rfnp', sigla: 'RFNP', descricao: 'Reservas fusionais negativas perto' },
]

// Defensivo: chaves antigas (longe_bo/longe_bi/perto_bo/perto_bi) eram objeto.
// Se algum subcampo legado vier por engano, ignoramos para não exibir "[object Object]".
function valorString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function SecaoReservasFusionais({ value, onChange, disabled }: Props) {
  const update = (p: Partial<ReservasFusionais>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Reservas fusionais</h2>
        <p className="text-xs text-muted-foreground">
          Reservas positivas (RFPL/RFPP) e negativas (RFNL/RFNP), preenchimento livre.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CAMPOS.map(({ key, sigla, descricao }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`rf-${key}`} className="text-xs">
              <span className="font-medium text-foreground">{sigla}</span>
              <span className="text-muted-foreground"> — {descricao}</span>
            </Label>
            <Input
              id={`rf-${key}`}
              disabled={disabled}
              value={valorString(value[key])}
              onChange={(e) => update({ [key]: e.target.value } as Partial<ReservasFusionais>)}
              className="h-9"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-rf">Observações</Label>
        <Textarea
          id="obs-rf"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
