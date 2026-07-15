'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PPC, PPA } from '@/types/clinical'

type Props = {
  valuePpc: Partial<PPC>
  valuePpa: Partial<PPA>
  onChangePpc: (parcial: Partial<PPC>) => void
  onChangePpa: (parcial: Partial<PPA>) => void
  disabled?: boolean
}

// Helper defensivo: ignora valores que não sejam string (fichas antigas tinham number).
// Auto-save mostra string vazia em vez de "0"/"NaN" e o preprocess do Zod descarta no save.
function valorString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// PPC + PPA (Etapa 5) — seção unificada com layout compacto.
// PPC: 3 campos livres com sufixo "cm" inline.
// PPA: 1 campo livre com sufixo "cm" inline.
// Observações: única (armazenada em ppc.observacoes).
export function SecaoPPC({ valuePpc, valuePpa, onChangePpc, onChangePpa, disabled }: Props) {
  const updatePpc = (p: Partial<PPC>) => onChangePpc({ ...valuePpc, ...p })
  const updatePpa = (p: Partial<PPA>) => onChangePpa({ ...valuePpa, ...p })

  // Input com sufixo "cm" alinhado à direita
  function campoCm(props: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
  }) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={props.id} className="text-xs">{props.label}</Label>
        <div className="relative">
          <Input
            id={props.id}
            disabled={disabled}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            className="pr-8 h-9"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            cm
          </span>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">PPC / PPA</h2>
        <p className="text-xs text-muted-foreground">
          Ponto próximo de convergência (PPC) e de acomodação (PPA), em centímetros.
        </p>
      </div>

      {/* PPC — 3 medidas livres lado a lado no desktop */}
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-sm">PPC</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {campoCm({
            id: 'ppc-objeto',
            label: 'Objeto real',
            value: valorString(valuePpc.objeto_real),
            onChange: (v) => updatePpc({ objeto_real: v }),
          })}
          {campoCm({
            id: 'ppc-luz',
            label: 'Com luz',
            value: valorString(valuePpc.luz),
            onChange: (v) => updatePpc({ luz: v }),
          })}
          {campoCm({
            id: 'ppc-luz-filtro',
            label: 'Com luz e filtro',
            value: valorString(valuePpc.luz_filtro),
            onChange: (v) => updatePpc({ luz_filtro: v }),
          })}
        </div>
      </div>

      {/* PPA — 1 medida livre, largura compacta */}
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-sm">PPA</Label>
        <div className="max-w-[200px]">
          {campoCm({
            id: 'ppa-valor',
            label: 'Valor',
            value: valorString(valuePpa.valor),
            onChange: (v) => updatePpa({ valor: v }),
          })}
        </div>
      </div>

      {/* Observações compartilhadas (gravadas em ppc.observacoes) */}
      <div className="space-y-2">
        <Label htmlFor="obs-ppc">Observações</Label>
        <Textarea
          id="obs-ppc"
          rows={2}
          disabled={disabled}
          value={valuePpc.observacoes ?? ''}
          onChange={(e) => updatePpc({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
