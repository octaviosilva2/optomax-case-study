'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { TestesMotoresComplementares } from '@/types/clinical'

type Props = {
  value: Partial<TestesMotoresComplementares>
  onChange: (parcial: Partial<TestesMotoresComplementares>) => void
  disabled?: boolean
}

// Seção nova (Etapa 5) — Olho dominante / Hirschberg / Krimsky.
// Renderizada ANTES do PPC dentro do grupo "Avaliação binocular".
export function SecaoTestesMotoresComplementares({ value, onChange, disabled }: Props) {
  const update = (p: Partial<TestesMotoresComplementares>) => onChange({ ...value, ...p })
  const [copied, setCopied] = useState(false)

  // Copia o símbolo Δ para a área de transferência
  async function handleCopyDelta() {
    try {
      await navigator.clipboard.writeText('Δ')
      setCopied(true)
      toast.success('Δ copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Testes motores complementares</h2>
          <p className="text-xs text-muted-foreground">Olho dominante, Hirschberg e Krimsky.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyDelta}
          className="shrink-0 gap-1.5 text-xs h-7 px-2"
          title="Copiar símbolo delta (Δ)"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span className="font-semibold">Δ</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Olho dominante */}
        <div className="space-y-2">
          <Label className="font-medium text-foreground">Olho dominante</Label>
          <RadioGroup
            disabled={disabled}
            value={value.olho_dominante ?? ''}
            onValueChange={(v) =>
              update({ olho_dominante: (v || '') as TestesMotoresComplementares['olho_dominante'] })
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="od" id="tmc-dom-od" />
              <Label htmlFor="tmc-dom-od" className="font-normal text-sm">OD</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="oe" id="tmc-dom-oe" />
              <Label htmlFor="tmc-dom-oe" className="font-normal text-sm">OE</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Hirschberg */}
        <div className="space-y-2">
          <Label className="font-medium text-foreground">Hirschberg</Label>
          <RadioGroup
            disabled={disabled}
            value={value.hirschberg ?? ''}
            onValueChange={(v) =>
              update({ hirschberg: (v || '') as TestesMotoresComplementares['hirschberg'] })
            }
            className="flex gap-4 flex-wrap"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="centrado" id="tmc-hir-centrado" />
              <Label htmlFor="tmc-hir-centrado" className="font-normal text-sm">Centrado</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="descentralizado" id="tmc-hir-descentralizado" />
              <Label htmlFor="tmc-hir-descentralizado" className="font-normal text-sm">Descentralizado</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Krimsky — preenchimento livre */}
      <div className="space-y-2 max-w-xs">
        <Label htmlFor="tmc-krimsky" className="font-medium text-foreground">Krimsky</Label>
        <Input
          id="tmc-krimsky"
          placeholder="ex: 5 Δ"
          disabled={disabled}
          value={value.krimsky ?? ''}
          onChange={(e) => update({ krimsky: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-tmc">Observações</Label>
        <Textarea
          id="obs-tmc"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
