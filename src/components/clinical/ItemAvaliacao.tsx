'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ItemAvaliacao as ItemAvaliacaoType } from '@/types/clinical'

type Props = {
  // Identificador único usado em ids dos radios (evita colisão entre vários itens na mesma página)
  id: string
  label: string
  value: Partial<ItemAvaliacaoType>
  onChange: (next: Partial<ItemAvaliacaoType>) => void
  disabled?: boolean
  // Quando true, mostra a observação só se resultado === 'alterado' (mais limpo visualmente)
  observacaoCondicional?: boolean
}

// Componente compacto: radio Normal/Alterado + input opcional de observação.
// Reutilizado em Reflexos Pupilares, Avaliação Motora, Biomicroscopia, Campos Visuais, etc.
export function ItemAvaliacao({
  id,
  label,
  value,
  onChange,
  disabled,
  observacaoCondicional = false,
}: Props) {
  const update = (p: Partial<ItemAvaliacaoType>) => onChange({ ...value, ...p })
  const mostrarObs = !observacaoCondicional || value.resultado === 'alterado'

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label className="font-medium text-foreground">{label}</Label>
        <RadioGroup
          disabled={disabled}
          value={value.resultado ?? ''}
          onValueChange={(v) =>
            update({ resultado: (v || null) as ItemAvaliacaoType['resultado'] })
          }
          className="flex gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="normal" id={`${id}-normal`} />
            <Label htmlFor={`${id}-normal`} className="font-normal text-sm">Normal</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="alterado" id={`${id}-alterado`} />
            <Label htmlFor={`${id}-alterado`} className="font-normal text-sm">Alterado</Label>
          </div>
        </RadioGroup>
      </div>
      {mostrarObs && (
        <Input
          placeholder="Observação"
          disabled={disabled}
          value={value.observacao ?? ''}
          onChange={(e) => update({ observacao: e.target.value })}
        />
      )}
    </div>
  )
}
