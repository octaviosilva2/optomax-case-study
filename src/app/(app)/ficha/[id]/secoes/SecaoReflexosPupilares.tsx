'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ReflexosPupilares, ReflexosPupilaresOlho } from '@/types/clinical'

type Props = {
  value: Partial<ReflexosPupilares>
  onChange: (parcial: Partial<ReflexosPupilares>) => void
  disabled?: boolean
}

// Colunas da tabela — usadas tanto no cabeçalho quanto no map de inputs
const COLUNAS: Array<{ key: keyof ReflexosPupilaresOlho; label: string }> = [
  { key: 'fotomotor', label: 'Fotomotor' },
  { key: 'consensual', label: 'Consensual' },
  { key: 'acomodativo', label: 'Acomodativo' },
]

export function SecaoReflexosPupilares({ value, onChange, disabled }: Props) {
  const update = (p: Partial<ReflexosPupilares>) => onChange({ ...value, ...p })

  // Atualiza um campo específico de um olho (preserva os outros campos do mesmo olho)
  function updateOlho(olho: 'od' | 'oe', campo: keyof ReflexosPupilaresOlho, novoValor: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<ReflexosPupilaresOlho>
    update({
      [olho]: {
        fotomotor: olhoAtual.fotomotor ?? '',
        consensual: olhoAtual.consensual ?? '',
        acomodativo: olhoAtual.acomodativo ?? '',
        [campo]: novoValor,
      } as ReflexosPupilaresOlho,
    })
  }

  function renderLinha(olho: 'od' | 'oe', titulo: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<ReflexosPupilaresOlho>
    return (
      <>
        {/* Mobile: card empilhado com label de olho + inputs verticais */}
        <div className="md:hidden rounded-md border border-border p-3 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {COLUNAS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`rp-${olho}-${key}-m`} className="text-xs">{label}</Label>
              <Input
                id={`rp-${olho}-${key}-m`}
                disabled={disabled}
                value={olhoAtual[key] ?? ''}
                onChange={(e) => updateOlho(olho, key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>

        {/* Desktop: linha da tabela com 4 colunas (label do olho + 3 inputs) */}
        <div className="hidden md:grid md:grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center">
          <Label className="text-sm font-semibold text-foreground">{titulo}</Label>
          {COLUNAS.map(({ key }) => (
            <Input
              key={key}
              id={`rp-${olho}-${key}`}
              disabled={disabled}
              value={olhoAtual[key] ?? ''}
              onChange={(e) => updateOlho(olho, key, e.target.value)}
              className="h-9"
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Reflexos pupilares</h2>
        <p className="text-xs text-muted-foreground">Avaliação por olho — preenchimento livre.</p>
      </div>

      <div className="space-y-3">
        {/* Cabeçalho da tabela — visível só no desktop, alinhado ao grid das linhas */}
        <div className="hidden md:grid md:grid-cols-[80px_1fr_1fr_1fr] gap-2">
          <span />
          {COLUNAS.map(({ key, label }) => (
            <span key={key} className="text-xs font-medium text-muted-foreground px-1">
              {label}
            </span>
          ))}
        </div>

        {renderLinha('od', 'OD')}
        {renderLinha('oe', 'OE')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-rp">Observações gerais</Label>
        <Textarea
          id="obs-rp"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
