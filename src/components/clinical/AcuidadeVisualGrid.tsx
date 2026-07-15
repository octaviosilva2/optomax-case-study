'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AcuidadeVisual, MedidaAV } from '@/types/clinical'

type Props = {
  value: Partial<AcuidadeVisual>
  onChange: (next: Partial<AcuidadeVisual>) => void
  disabled?: boolean
}

// Linhas (olho × distância) — keys correspondem ao schema
const LINHAS: Array<{ key: keyof AcuidadeVisual; label: string }> = [
  { key: 'od_longe', label: 'OD Longe' },
  { key: 'oe_longe', label: 'OE Longe' },
  { key: 'ao_longe', label: 'AO Longe' },
  { key: 'od_perto', label: 'OD Perto' },
  { key: 'oe_perto', label: 'OE Perto' },
  { key: 'ao_perto', label: 'AO Perto' },
]

export function AcuidadeVisualGrid({ value, onChange, disabled }: Props) {
  function updateMedida(linha: keyof AcuidadeVisual, parcial: Partial<MedidaAV>) {
    const atual = (value[linha] ?? {}) as Partial<MedidaAV>
    onChange({ ...value, [linha]: { ...atual, ...parcial } })
  }

  return (
    <div className="overflow-x-auto">
      {/* Etapa 7 (#19): coluna Decimal e labels Snellen/Decimal removidas da UI.
          Tipo MedidaAV mantém `decimal` para compat com fichas antigas no JSONB. */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="w-28 pb-2"></th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {LINHAS.map(({ key, label }) => {
            const m = (value[key] ?? {}) as Partial<MedidaAV>
            return (
              <tr key={key}>
                <td className="py-1">
                  <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
                </td>
                <td className="py-1 px-1">
                  <Input
                    placeholder="preencher"
                    disabled={disabled}
                    value={m.snellen ?? ''}
                    onChange={(e) => updateMedida(key, { snellen: e.target.value })}
                    className="h-9"
                    aria-label={label}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
