'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Ceratometria, CeratometriaOlho } from '@/types/clinical'

type Props = {
  value: Partial<Ceratometria>
  onChange: (parcial: Partial<Ceratometria>) => void
  disabled?: boolean
}

const CAMPOS: Array<{ key: keyof CeratometriaOlho; label: string; min: number; max: number; step: number }> = [
  { key: 'k1', label: 'K1', min: 30, max: 60, step: 0.25 },
  { key: 'k2', label: 'K2', min: 30, max: 60, step: 0.25 },
  { key: 'eixo', label: 'EIXO', min: 0, max: 180, step: 1 },
]

export function SecaoCeratometria({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Ceratometria>) => onChange({ ...value, ...p })

  function updateOlho(linha: 'od' | 'oe', campo: keyof CeratometriaOlho, raw: string) {
    const num = raw.trim() === '' ? null : Number(raw)
    if (num !== null && Number.isNaN(num)) return
    const atual = (value[linha] ?? {}) as Partial<CeratometriaOlho>
    update({ [linha]: { ...atual, [campo]: num } } as Partial<Ceratometria>)
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ceratometria</h2>
        <p className="text-xs text-muted-foreground">Curvatura corneana (K1, K2 e eixo).</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="w-12 pb-2"></th>
              {CAMPOS.map((c) => (
                <th key={c.key} className="pb-2 px-2 font-medium text-muted-foreground">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['od', 'oe'] as const).map((linha) => (
              <tr key={linha}>
                <td className="py-1">
                  <Label className="text-xs uppercase text-muted-foreground">{linha.toUpperCase()}</Label>
                </td>
                {CAMPOS.map((c) => {
                  const v = (value[linha] as Partial<CeratometriaOlho> | undefined)?.[c.key]
                  return (
                    <td key={c.key} className="py-1 px-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={c.min}
                        max={c.max}
                        step={c.step}
                        disabled={disabled}
                        value={v ?? ''}
                        onChange={(e) => updateOlho(linha, c.key, e.target.value)}
                        className="h-9 w-full text-center"
                        aria-label={`${linha.toUpperCase()} ${c.label}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-cera">Observações</Label>
        <Textarea
          id="obs-cera"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
