'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/clinical/FieldError'
import { cn } from '@/lib/utils'
import type {
  CampoRefracao,
  CampoRefracaoKey,
  LinhaRefracao,
  OlhosDuplos,
} from '@/types/clinical'
import { CAMPOS_REFRACAO, LINHAS_REFRACAO } from '@/types/clinical'

type Props = {
  value: Partial<OlhosDuplos>
  onChange: (next: Partial<OlhosDuplos>) => void
  disabled?: boolean
  /** Mapa de "od.esf", "oe.cil", etc -> mensagem de erro */
  erros?: Record<string, string>
}

// Etapa 6 (#27 + #29): grade virou texto livre, DNP foi removido.
// Cada campo aceita qualquer formato clínico (ex: "-2.50", "+0.75", "neutro", "PL", "90°").
// Placeholder serve apenas como dica visual.
const SPEC: Record<CampoRefracaoKey, { label: string; placeholder: string }> = {
  esf: { label: 'ESF', placeholder: 'ex: -2.50' },
  cil: { label: 'CIL', placeholder: 'ex: -1.25' },
  eixo: { label: 'EIXO', placeholder: 'ex: 90' },
  add: { label: 'ADD', placeholder: 'ex: +1.50' },
}

// Defensivo: fichas antigas podem ter `number` em algum campo. Converte para string
// para alimentar o Input controlado sem warning de React.
function toInputValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

export function DioptriasGrid({ value, onChange, disabled, erros = {} }: Props) {
  function atualizar(
    linha: LinhaRefracao,
    campo: CampoRefracaoKey,
    raw: string,
  ) {
    // Texto livre: passa direto o que o usuário digitou (sem validação numérica).
    const linhaAtual = (value[linha] ?? {}) as Partial<CampoRefracao>
    onChange({
      ...value,
      [linha]: { ...linhaAtual, [campo]: raw },
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="w-12 pb-2"></th>
            {CAMPOS_REFRACAO.map((c) => (
              <th key={c} className="pb-2 px-2 text-eyebrow">
                {SPEC[c].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS_REFRACAO.map((linha) => (
            <tr key={linha}>
              <td className="py-1">
                <Label className="text-xs uppercase text-muted-foreground">
                  {linha.toUpperCase()}
                </Label>
              </td>
              {CAMPOS_REFRACAO.map((campo) => {
                const valBruto = (value[linha] as Partial<CampoRefracao> | undefined)?.[campo]
                const v = toInputValue(valBruto)
                const spec = SPEC[campo]
                const erroKey = `${linha}.${campo}`
                const erro = erros[erroKey]
                return (
                  <td key={campo} className="py-1 px-1">
                    <div className="relative">
                      <Input
                        type="text"
                        disabled={disabled}
                        value={v}
                        placeholder={spec.placeholder}
                        onChange={(e) => atualizar(linha, campo, e.target.value)}
                        className={cn(
                          // tabular-nums font-mono: DESIGN.md regra firme para campos clinicos
                          'h-9 w-full text-center tabular-nums font-mono',
                          erro && 'border-destructive focus-visible:ring-destructive pr-6'
                        )}
                        aria-label={`${linha.toUpperCase()} ${spec.label}`}
                      />
                      {erro && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2">
                          <FieldError mensagem={erro} />
                        </span>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
