'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Subjetivo, SubjetivoOlho } from '@/types/clinical'

type Props = {
  value: Partial<Subjetivo>
  onChange: (parcial: Partial<Subjetivo>) => void
  disabled?: boolean
}

// Colunas da tabela — primeira é livre (refração), seguidas das AVs
const COLUNAS: Array<{ key: keyof SubjetivoOlho; label: string }> = [
  { key: 'campo_livre', label: 'Refração' },
  { key: 'av_longe', label: 'AV Longe' },
  { key: 'av_perto', label: 'AV Perto' },
]

export function SecaoSubjetivo({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Subjetivo>) => onChange({ ...value, ...p })

  // Atualiza um campo de um olho preservando os demais
  function updateOlho(olho: 'od' | 'oe', campo: keyof SubjetivoOlho, novoValor: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<SubjetivoOlho>
    update({
      [olho]: {
        campo_livre: olhoAtual.campo_livre ?? '',
        av_longe: olhoAtual.av_longe ?? '',
        av_perto: olhoAtual.av_perto ?? '',
        [campo]: novoValor,
      } as SubjetivoOlho,
    })
  }

  function renderCardMobile(olho: 'od' | 'oe', titulo: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<SubjetivoOlho>
    return (
      <div className="rounded-md border border-border p-3 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {COLUNAS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`subj-${olho}-${key}-m`} className="text-xs">{label}</Label>
            <Input
              id={`subj-${olho}-${key}-m`}
              disabled={disabled}
              value={olhoAtual[key] ?? ''}
              onChange={(e) => updateOlho(olho, key, e.target.value)}
              className="h-9"
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Subjetivo</h2>
        <p className="text-xs text-muted-foreground">Refração subjetiva com acuidade visual de longe e perto.</p>
      </div>

      {/* Desktop: tabela com cabeçalho (label do olho + 3 colunas) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[60px_2fr_1fr_1fr] gap-2 mb-2">
          <span />
          {COLUNAS.map(({ key, label }) => (
            <span key={key} className="text-xs font-medium text-muted-foreground px-1">
              {label}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {(['od', 'oe'] as const).map((olho) => {
            const olhoAtual = (value[olho] ?? {}) as Partial<SubjetivoOlho>
            return (
              <div key={olho} className="grid grid-cols-[60px_2fr_1fr_1fr] gap-2 items-center">
                <Label className="text-sm font-semibold text-foreground">
                  {olho === 'od' ? 'OD' : 'OE'}
                </Label>
                {COLUNAS.map(({ key }) => (
                  <Input
                    key={key}
                    id={`subj-${olho}-${key}`}
                    disabled={disabled}
                    value={olhoAtual[key] ?? ''}
                    onChange={(e) => updateOlho(olho, key, e.target.value)}
                    className="h-9"
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: dois cards empilhados (um por olho) */}
      <div className="md:hidden space-y-3">
        {renderCardMobile('od', 'OD')}
        {renderCardMobile('oe', 'OE')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-subj">Observações</Label>
        <Textarea
          id="obs-subj"
          rows={3}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
