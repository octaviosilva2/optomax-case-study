'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FieldError } from '@/components/clinical/FieldError'
import { cn } from '@/lib/utils'
import type { Anamnese } from '@/types/clinical'

type Props = {
  value: Partial<Anamnese>
  onChange: (parcial: Partial<Anamnese>) => void
  disabled?: boolean
  /** Mapa de "campo" -> mensagem de erro (vindo do Zod path) */
  erros?: Record<string, string>
}

export function SecaoAnamnese({ value, onChange, disabled, erros = {} }: Props) {
  const update = (p: Partial<Anamnese>) => onChange({ ...value, ...p })
  const temErro = Object.keys(erros).length > 0

  return (
    <section className={cn(
      "rounded-xl border bg-card p-6 shadow-sm space-y-4",
      temErro && "border-destructive ring-1 ring-destructive"
    )}>
      <h2 className="text-base font-semibold text-foreground">Anamnese</h2>

      <div className="space-y-2">
        <Label htmlFor="queixa" className="flex items-center">
          Queixa principal
          {erros['queixa_principal'] && <FieldError mensagem={erros['queixa_principal']} />}
        </Label>
        <Textarea
          id="queixa"
          rows={2}
          disabled={disabled}
          value={value.queixa_principal ?? ''}
          onChange={(e) => update({ queixa_principal: e.target.value })}
          className={cn(erros['queixa_principal'] && 'border-destructive focus-visible:ring-destructive')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hda">História da doença atual</Label>
        <Textarea
          id="hda"
          rows={3}
          disabled={disabled}
          value={value.historia_doenca_atual ?? ''}
          onChange={(e) => update({ historia_doenca_atual: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Usa óculos atualmente?</Label>
          <RadioGroup
            disabled={disabled}
            value={value.uso_oculos_atual ?? ''}
            onValueChange={(v) =>
              update({ uso_oculos_atual: v as Anamnese['uso_oculos_atual'] })
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="uso-sim" />
              <Label htmlFor="uso-sim" className="font-normal">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="uso-nao" />
              <Label htmlFor="uso-nao" className="font-normal">Não</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="as_vezes" id="uso-asv" />
              <Label htmlFor="uso-asv" className="font-normal">Às vezes</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tempo-uso">Tempo de uso</Label>
          <Input
            id="tempo-uso"
            disabled={disabled}
            value={value.tempo_uso_oculos ?? ''}
            onChange={(e) => update({ tempo_uso_oculos: e.target.value })}
            placeholder="ex: 3 anos"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ultima">Última consulta Optométrica / Oftalmológica</Label>
        <Input
          id="ultima"
          disabled={disabled}
          value={value.ultima_consulta ?? ''}
          onChange={(e) => update({ ultima_consulta: e.target.value })}
          placeholder="ex: há 1 ano"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="alergias">Alergias</Label>
          <Textarea
            id="alergias"
            rows={2}
            disabled={disabled}
            value={value.alergias ?? ''}
            onChange={(e) => update({ alergias: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="medicamentos">Medicamentos em uso</Label>
          <Textarea
            id="medicamentos"
            rows={2}
            disabled={disabled}
            value={value.medicamentos_uso ?? ''}
            onChange={(e) => update({ medicamentos_uso: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cirurgias">Cirurgias oculares prévias</Label>
        <Textarea
          id="cirurgias"
          rows={2}
          disabled={disabled}
          value={value.cirurgias_oculares ?? ''}
          onChange={(e) => update({ cirurgias_oculares: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs-anamnese">Observações</Label>
        <Textarea
          id="obs-anamnese"
          rows={2}
          disabled={disabled}
          value={value.observacoes ?? ''}
          onChange={(e) => update({ observacoes: e.target.value })}
        />
      </div>
    </section>
  )
}
