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
import type { Encaminhamento } from '@/types/clinical'

type Props = {
  value: Partial<Encaminhamento>
  onChange: (parcial: Partial<Encaminhamento>) => void
  disabled?: boolean
}

export function SecaoEncaminhamento({ value, onChange, disabled }: Props) {
  const update = (p: Partial<Encaminhamento>) => onChange({ ...value, ...p })
  const necessario = !!value.necessario

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">Encaminhamento</h2>

      {/* Toggle: exibe o restante do formulário apenas se necessário=true */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="enc-nec"
          disabled={disabled}
          checked={necessario}
          onCheckedChange={(c) => update({ necessario: c === true })}
        />
        <Label htmlFor="enc-nec" className="font-normal">
          Encaminhar para outro especialista
        </Label>
      </div>

      {necessario && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="esp">Especialidade</Label>
              <Input
                id="esp"
                disabled={disabled}
                value={value.especialidade ?? ''}
                onChange={(e) => update({ especialidade: e.target.value })}
                placeholder="ex: oftalmologista, neurologista"
              />
            </div>

            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select
                disabled={disabled}
                value={value.urgencia ?? ''}
                onValueChange={(v) =>
                  update({ urgencia: v as Encaminhamento['urgencia'] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rotina">Rotina</SelectItem>
                  <SelectItem value="preferencial">Preferencial</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              rows={3}
              disabled={disabled}
              value={value.motivo ?? ''}
              onChange={(e) => update({ motivo: e.target.value })}
            />
          </div>
        </div>
      )}
    </section>
  )
}
