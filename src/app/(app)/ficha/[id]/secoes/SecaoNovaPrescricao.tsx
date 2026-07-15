'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DioptriasGrid } from '@/components/clinical/DioptriasGrid'
import { cn } from '@/lib/utils'
import type { NovaPrescricao } from '@/types/clinical'

type Props = {
  value: Partial<NovaPrescricao>
  onChange: (parcial: Partial<NovaPrescricao>) => void
  disabled?: boolean
  // Modo Completo: titulo customizado ("Refração final")
  titulo?: string
  descricao?: string
  /** Mapa de "campo" -> mensagem de erro (paths do Zod sem prefixo da seção) */
  erros?: Record<string, string>
}

// Tratamentos disponíveis para seleção múltipla
const TRATAMENTOS: Array<{ id: string; label: string }> = [
  { id: 'antirreflexo', label: 'Antirreflexo' },
  { id: 'fotossensivel', label: 'Fotossensível' },
  { id: 'bluelight', label: 'Filtro de luz azul' },
]

export function SecaoNovaPrescricao({
  value,
  onChange,
  disabled,
  titulo,
  descricao,
  erros = {},
}: Props) {
  const update = (p: Partial<NovaPrescricao>) => onChange({ ...value, ...p })

  // Alterna um tratamento na lista (adiciona ou remove)
  function toggleTratamento(id: string, marcar: boolean) {
    const atuais = value.tratamentos ?? []
    const novos = marcar
      ? Array.from(new Set([...atuais, id]))
      : atuais.filter((t) => t !== id)
    update({ tratamentos: novos })
  }

  const temErro = Object.keys(erros).length > 0

  return (
    <section className={cn(
      "rounded-xl border bg-card p-6 shadow-sm space-y-4",
      temErro && "border-destructive ring-1 ring-destructive"
    )}>
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {titulo ?? 'Nova prescrição'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {descricao ?? 'Refração final prescrita ao paciente.'}
        </p>
      </div>

      {/* Grade 2×5 reutilizável de OD/OE × ESF/CIL/EIXO/DNP/ADD */}
      <DioptriasGrid
        value={{ od: value.od, oe: value.oe }}
        onChange={(olhos) => update(olhos)}
        disabled={disabled}
        erros={Object.fromEntries(
          Object.entries(erros).filter(([k]) => k.startsWith('od.') || k.startsWith('oe.'))
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de lente</Label>
          <Select
            disabled={disabled}
            value={value.tipo_lente ?? ''}
            onValueChange={(v) =>
              update({ tipo_lente: v as NovaPrescricao['tipo_lente'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monofocal">Monofocal</SelectItem>
              <SelectItem value="bifocal">Bifocal</SelectItem>
              <SelectItem value="multifocal">Multifocal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="validade-presc">Válida por (meses)</Label>
          <Input
            id="validade-presc"
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            disabled={disabled}
            placeholder="ex: 12"
            value={value.validade_meses ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              const n = Number(v)
              update({ validade_meses: v === '' || Number.isNaN(n) ? null : n })
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tratamentos</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TRATAMENTOS.map((t) => {
            const marcado = (value.tratamentos ?? []).includes(t.id)
            return (
              <div key={t.id} className="flex items-center gap-2">
                <Checkbox
                  id={`tr-${t.id}`}
                  disabled={disabled}
                  checked={marcado}
                  onCheckedChange={(c) => toggleTratamento(t.id, c === true)}
                />
                <Label htmlFor={`tr-${t.id}`} className="font-normal">
                  {t.label}
                </Label>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-presc">Observações</Label>
        <Textarea
          id="obs-presc"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
