'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { CoverTest, CoverTestMedida } from '@/types/clinical'

type Props = {
  value: Partial<CoverTest>
  onChange: (parcial: Partial<CoverTest>) => void
  disabled?: boolean
}

// 3 distâncias de medição — chaves do tipo + label visível
const DISTANCIAS: Array<{ key: keyof Omit<CoverTest, 'observacoes'>; label: string }> = [
  { key: 'seis_metros', label: '6 metros' },
  { key: 'quarenta_cm', label: '40 cm' },
  { key: 'vinte_cm', label: '20 cm' },
]

export function SecaoCoverTest({ value, onChange, disabled }: Props) {
  const update = (p: Partial<CoverTest>) => onChange({ ...value, ...p })
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

  // Coerção defensiva: fichas antigas têm `magnitude: number | null` (em `longe`/`perto`).
  // Para a UI nova, exibimos vazio se vier estrutura legada.
  function valorString(raw: unknown): string {
    if (raw === null || raw === undefined) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'number') return String(raw)
    return ''
  }

  function updateMedida(key: keyof Omit<CoverTest, 'observacoes'>, magnitude: string) {
    update({ [key]: { magnitude } as CoverTestMedida } as Partial<CoverTest>)
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cover test</h2>
          <p className="text-xs text-muted-foreground">Avaliação de heterotropia/heteroforia em 3 distâncias — preenchimento livre.</p>
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

      <div className="space-y-2">
        {/* Cabeçalho de colunas — visível só no desktop */}
        <div className="hidden md:grid md:grid-cols-[120px_1fr] gap-2">
          <span />
          <span className="text-xs font-medium text-muted-foreground px-1">Magnitude (Δ)</span>
        </div>

        {DISTANCIAS.map(({ key, label }) => {
          const medida = (value[key] ?? {}) as Partial<CoverTestMedida>
          return (
            <div key={key} className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:items-center">
              <Label htmlFor={`ct-${key}`} className="text-sm font-medium text-foreground">
                {label}
              </Label>
              <div className="space-y-1">
                <Label htmlFor={`ct-${key}`} className="text-xs text-muted-foreground md:hidden">
                  Magnitude (Δ)
                </Label>
                <Input
                  id={`ct-${key}`}
                  disabled={disabled}
                  placeholder="ex: 4 Δ Exo"
                  value={valorString(medida.magnitude)}
                  onChange={(e) => updateMedida(key, e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-ct">Observações</Label>
        <Textarea
          id="obs-ct"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
