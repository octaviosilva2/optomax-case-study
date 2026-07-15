'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Biomicroscopia, BiomicroscopiaOlho } from '@/types/clinical'

type Props = {
  value: Partial<Biomicroscopia>
  onChange: (parcial: Partial<Biomicroscopia>) => void
  disabled?: boolean
}

// Campos da biomicroscopia (sem "câmara anterior" — removida por decisão clínica)
const CAMPOS: Array<{ key: keyof BiomicroscopiaOlho; label: string }> = [
  { key: 'sobrancelha', label: 'Sobrancelha' },
  { key: 'palpebra', label: 'Pálpebra' },
  { key: 'cilios', label: 'Cílios' },
  { key: 'cornea', label: 'Córnea' },
  { key: 'iris', label: 'Íris' },
  { key: 'conjuntiva', label: 'Conjuntiva' },
  { key: 'esclera', label: 'Esclera' },
  { key: 'cristalino', label: 'Cristalino' },
  { key: 'pupilas', label: 'Pupilas' },
]

// Valores padrão zerados — usados ao montar o objeto de um olho ao atualizar um único campo
const OLHO_VAZIO: BiomicroscopiaOlho = {
  sobrancelha: '',
  palpebra: '',
  cilios: '',
  cornea: '',
  iris: '',
  conjuntiva: '',
  esclera: '',
  cristalino: '',
  pupilas: '',
}

export function SecaoBiomicroscopia({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Biomicroscopia>) => onChange({ ...value, ...p })

  // Atualiza um campo de um olho preservando os demais
  function updateOlho(olho: 'od' | 'oe', campo: keyof BiomicroscopiaOlho, novoValor: string) {
    const olhoAtual = { ...OLHO_VAZIO, ...(value[olho] ?? {}) } as BiomicroscopiaOlho
    update({ [olho]: { ...olhoAtual, [campo]: novoValor } } as Partial<Biomicroscopia>)
  }

  // Renderiza um card de olho — usado no layout mobile
  function renderCardMobile(olho: 'od' | 'oe', titulo: string) {
    const olhoAtual = (value[olho] ?? {}) as Partial<BiomicroscopiaOlho>
    return (
      <div className="rounded-md border border-border p-3 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {CAMPOS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`bio-${olho}-${key}-m`} className="text-xs">{label}</Label>
            <Input
              id={`bio-${olho}-${key}-m`}
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
        <h2 className="text-base font-semibold text-foreground">Biomicroscopia</h2>
        <p className="text-xs text-muted-foreground">Avaliação do segmento anterior — preenchimento livre por olho.</p>
      </div>

      {/* Desktop: tabela com cabeçalho + 9 linhas (label + OD + OE) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[140px_1fr_1fr] gap-2 mb-2">
          <span />
          <span className="text-xs font-medium text-muted-foreground px-1">OD</span>
          <span className="text-xs font-medium text-muted-foreground px-1">OE</span>
        </div>
        <div className="space-y-2">
          {CAMPOS.map(({ key, label }) => {
            const od = (value.od ?? {}) as Partial<BiomicroscopiaOlho>
            const oe = (value.oe ?? {}) as Partial<BiomicroscopiaOlho>
            return (
              <div key={key} className="grid grid-cols-[140px_1fr_1fr] gap-2 items-center">
                <Label htmlFor={`bio-od-${key}`} className="text-sm">{label}</Label>
                <Input
                  id={`bio-od-${key}`}
                  disabled={disabled}
                  value={od[key] ?? ''}
                  onChange={(e) => updateOlho('od', key, e.target.value)}
                  className="h-9"
                />
                <Input
                  id={`bio-oe-${key}`}
                  disabled={disabled}
                  value={oe[key] ?? ''}
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
        <Label htmlFor="obs-bio">Observações gerais</Label>
        <Textarea
          id="obs-bio"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
