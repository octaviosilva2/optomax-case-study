'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Oftalmoscopia, OftalmoscopiaOlho } from '@/types/clinical'

type Props = {
  value: Partial<Oftalmoscopia>
  onChange: (parcial: Partial<Oftalmoscopia>) => void
  disabled?: boolean
}

// 7 campos livres por olho — ordem da imagem 5
const CAMPOS: Array<{ key: keyof OftalmoscopiaOlho; label: string }> = [
  { key: 'dioptria_lente', label: 'Dioptria lente Oftalmoscópio' },
  { key: 'bruckner', label: 'Brückner' },
  { key: 'pupila', label: 'Pupila' },
  { key: 'escavacao', label: 'Escavação' },
  { key: 'relacao_av', label: 'Relação artéria/veia' },
  { key: 'macula', label: 'Mácula' },
  { key: 'fixacao', label: 'Fixação' },
]

export function SecaoOftalmoscopia({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Oftalmoscopia>) => onChange({ ...value, ...p })

  // Coerção defensiva: campos antigos podem vir como ItemAvaliacao ({resultado, observacao}) ou number
  // (no caso de escavacao). Para a UI, exibimos sempre string. Se vier estrutura legada, mostramos vazio.
  function valorString(raw: unknown): string {
    if (raw === null || raw === undefined) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'number') return String(raw)
    return ''
  }

  function updateOlho(olho: 'od' | 'oe', campo: keyof OftalmoscopiaOlho, novoValor: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<OftalmoscopiaOlho>
    const olhoNormalizado: OftalmoscopiaOlho = {
      dioptria_lente: valorString(olhoAtual.dioptria_lente),
      bruckner: valorString(olhoAtual.bruckner),
      pupila: valorString(olhoAtual.pupila),
      escavacao: valorString(olhoAtual.escavacao),
      relacao_av: valorString(olhoAtual.relacao_av),
      macula: valorString(olhoAtual.macula),
      fixacao: valorString(olhoAtual.fixacao),
    }
    update({ [olho]: { ...olhoNormalizado, [campo]: novoValor } } as Partial<Oftalmoscopia>)
  }

  function renderCardMobile(olho: 'od' | 'oe', titulo: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<OftalmoscopiaOlho>
    return (
      <div className="rounded-md border border-border p-3 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {CAMPOS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`oft-${olho}-${key}-m`} className="text-xs">{label}</Label>
            <Input
              id={`oft-${olho}-${key}-m`}
              disabled={disabled}
              value={valorString(olhoAtual[key])}
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
        <h2 className="text-base font-semibold text-foreground">Oftalmoscopia Direta</h2>
        <p className="text-xs text-muted-foreground">Avaliação do fundo de olho — preenchimento livre por olho.</p>
      </div>

      {/* Desktop: tabela com cabeçalho + 7 linhas (label + OD + OE) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[200px_1fr_1fr] gap-2 mb-2">
          <span />
          <span className="text-xs font-medium text-muted-foreground px-1">OD</span>
          <span className="text-xs font-medium text-muted-foreground px-1">OE</span>
        </div>
        <div className="space-y-2">
          {CAMPOS.map(({ key, label }) => {
            const od = (value.od ?? {}) as Partial<OftalmoscopiaOlho>
            const oe = (value.oe ?? {}) as Partial<OftalmoscopiaOlho>
            return (
              <div key={key} className="grid grid-cols-[200px_1fr_1fr] gap-2 items-center">
                <Label htmlFor={`oft-od-${key}`} className="text-sm">{label}</Label>
                <Input
                  id={`oft-od-${key}`}
                  disabled={disabled}
                  value={valorString(od[key])}
                  onChange={(e) => updateOlho('od', key, e.target.value)}
                  className="h-9"
                />
                <Input
                  id={`oft-oe-${key}`}
                  disabled={disabled}
                  value={valorString(oe[key])}
                  onChange={(e) => updateOlho('oe', key, e.target.value)}
                  className="h-9"
                />
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
        <Label htmlFor="obs-oft">Observações gerais</Label>
        <Textarea
          id="obs-oft"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
